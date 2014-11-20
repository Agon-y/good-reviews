good-reviews
============

A goodreads API for sending messages

Example use, see: http://diegallantly.com/2014/11/20/good-reviews/

Installation instructions:

1. Download this directory as a zip (look to your right) and unzip it somewhere
2. Install nodejs: http://nodejs.org/
3. cd into the unzipped directory and run 'npm install' then 'bower install'
4. Install MySQL. http://dev.mysql.com/downloads/mysql/
5. Open up create.sql in the 'database' directory and run it to create the necessary databases.
6. Open up goodreads/index.js and plug your deathbycaptcha login info into this line:
  dbc = new DeathByCaptcha('username', 'password').
  If you don't do this, this code will silently error and you'll be prompted to solve captchas for each message.
7. back in the main directoy, 'grunt copy' and then 'grunt' to create the client files and start the app
8. Hit up localhost:1337 to see it in action!
9. Email me with questions, comments, insults and abject failures.
