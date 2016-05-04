import Promise from 'bluebird';

import { Doctor, Review } from '../database';
import { emit } from '../sockets';
import Scraper from './scraper';
import logger from '../logger';

const log = logger.create('Scraper:Service');

export class ScraperService {
  /**
   * Scrape a single doctor
   * @param object doctor Doctor object to scrape
   */
  single(doctor) {
    log.verbose(`Starting scrape for [${doctor.name}]`);
    emit('scrape:start', doctor.name); // TODO change back to doctor

    const scraper = new Scraper();
    return scraper.fullScrape().fromDoctor(doctor)
      .then((result) => {
        // Check to make sure the scraped id was valid
        if (!result.doctor.name) {
          return false;
        }

        // Update the doctor data in the database
        doctor.update(result.doctor);

        // Get the latest review and compare with results
        return doctor.getReview().then((oldReview) => {
          let isNewer = false;
          if (oldReview) {
            isNewer = oldReview.reviewId !== result.review.reviewId;
          } else {
            log.verbose(`Completed initial scraping for new doctor [${doctor.name}]`);
          }

          let query;
          if (!oldReview) {
            query = Review().create(result.review)
              .then((reviewInstance) => doctor.setReview(reviewInstance));
          } else if (isNewer) {
            query = oldReview.update(result.review);
            log.verbose(`[${doctor.name}] has a new review [${result.review.reviewId}]`);
          }

          // If there is no review, or a newer review emit finish event
          if (query) {
            return query.then(() => {
              emit('scrape:finish', Object.assign(doctor, { review: result.review }).id);
              log.verbose(`Scrape finished for [${doctor.name}]`);
              if (isNewer) {
                // TODO Email Admin + all users in doctor:emailList
                emit('scrape:new', `New review for [${doctor.name}]`);
              }
              return doctor;
            });
          }

          // Nothing to do, finish up
          emit('scrape:finish', Object.assign(doctor, { review: oldReview }).name); // TODO change back to doctor
          log.verbose(`Scrape finished for [${doctor.name}]`);
          return doctor;
        });
      })
      .catch((err) => {
        log.warning(`Failed to scrape doctor [${doctor.id}]`, err);
        return emit('scrape:failed', Object.assign(err, { doctor: { id: doctor.id } }));
      });
  }

  /**
   * Scrape all the doctors in the database
   */
  all() {
    return Doctor().findAll()
      .then((doctors) => {
        if (doctors.length === 0) {
          log.info('No doctors to scrape');
          return;
        }

        log.info(`Scraping [${doctors.length}] doctors.`);
        emit('scrapeAll:start');
        const scrapePromises = [];
        for (const doctor of doctors) {
          scrapePromises.push(this.single(doctor));
        }

        return Promise.all(scrapePromises).then(() => {
          emit('scrapeAll:finish');
          log.info('Scraping for all doctors finished');
        });
      })
      .catch((err) => log.error('Error finding all doctors', err));
  }
}

export default ScraperService;
