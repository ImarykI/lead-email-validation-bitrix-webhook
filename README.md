## Why?
So we don't reach the maximum number of failed or deferred emails per hour, and our outgoing emails don't get blocked for another 60 minutes every time.
## How it works?

The app runs all the time on a cPanel shared hosting server. It listens to a POST request on the */webhook/lead-handler* route that should contain a **lead_id** and the right **api_key** as parameters in order to validate its source.

With the Lead ID stored, it calls the required methods of the Bitrix24 RESTful API and gets the email from the lead contact.

Then it calls the *single.check()* method on NeverBound to verify the email:

- If **invalid, disposable, or unknown**, a custom boolean field in CRM is set to true and an invalid comment is added to the lead;

- otherwise, just add a comment to notify the user that the lead was in fact verified;

Now I can set the condition in Bitrix24 Robots: if **custom_field** is false, then execute *Email Sending Automation*.

It's that simple.

**P. S**
It's my first *"non-tutorial-following"* Node.js application ever made, so if you have some constructive feedback, I will happily receive it.