import axios from 'axios'

let init = 0;

export function logHttp() {
  if (init == 0) {
    init++;

    logAxios();

    logHttpsModule();
  }
}

function logHttpsModule() {

    let httpModule = require('https');

    var originalRequestFunction = httpModule.request;
  
    httpModule.request = function(options: any, callback: any){
      console.log('https req:', options, callback);
      return originalRequestFunction(options, callback)
    }  
    
    httpModule.get = function(options: any, callback: any){
      console.log('https get req:', options, callback);
      return originalRequestFunction(options, callback)
    }
}

function logAxios() {
      axios.interceptors.request.use( x => {
      // console.log(`${x.method} ${x.url}`);
      // console.log(`data: ${JSON.stringify(x.data)}`);
      return x;
    });
  
    axios.interceptors.response.use(x => {
      console.log(`${x.config.method} ${x.config.url} ${x.statusText} ${x.status}`);
      console.log(`data: ${x.config.data}`);
      console.log(`data: ${JSON.stringify(x.data)}`);
      return x;
    });
}

