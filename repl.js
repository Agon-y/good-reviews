var repl = require("repl");
 
var replServer = repl.start({
  prompt: "my-app > ",
});
 
replServer.context.goodreads = require('./goodreads');