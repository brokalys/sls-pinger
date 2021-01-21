import mailgun from 'mailgun-js';

export default mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});
