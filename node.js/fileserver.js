// fileserver.js : Fileserver redirector
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2014
// Modified By: Eric Flumerfelt
//

// A function to find the https:// url of the current host
module.exports = function (reqUrl, webdir, host, port) {
    // Get the current path, minus the /fileserver
  var path = reqUrl.replace(webdir,"");
  
  // Log what the path is, without the :<port> that we listen on
  console.log("path: " + host.replace(":" + port,"") + path);
  // Return the path
  return "https://" + host.replace(":" + port,"") + path;
}

