import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ALLOWED_ORIGINS } from '@/config/runtimeSettings';

export const config = {
  matcher: ['/api/:path*'] 
}

export function middleware(request: NextRequest) {

  const requestHeaders = new Headers(request.headers);

  let host = requestHeaders.get('host') || '#invalid#host#';
  let origin = requestHeaders.get('origin');

  if (!origin) {
    //console.log(`no-o ${request.method} ${request.nextUrl.pathname} `);
    return NextResponse.next({        // continue in request chain
      request: {
        headers: requestHeaders,
      },
    });
  } else if (origin.endsWith(host)) {
    //console.log(`eq-o ${request.method} ${request.nextUrl.pathname} `);
    return NextResponse.next({        // continue in request chain
      request: {
        headers: requestHeaders,
      },
    });
  } else if (!ALLOWED_ORIGINS.includes(origin)) {  
    //console.log(`bado ${request.method} ${request.nextUrl.pathname} origin=${origin}`);
    return new NextResponse(null, { // direct Response (invalid origin)
      status: 400,
      statusText: 'Bad request origin'
    });
  } else if (request.method == 'OPTIONS') {  // Preflight request
    //console.log(`pref ${request.method} ${request.nextUrl.pathname} `);
    return new NextResponse(null, {   // direct Response (preflight ok)
      status: 204,
      headers: [
        [ 'Access-Control-Allow-Origin', origin as string ],
        [ 'Access-Control-Allow-Headers', requestHeaders.get('Access-Control-Request-Headers') || '' ],   // add valid custom headers in preflight response only
        [ 'Access-Control-Allow-Methods', requestHeaders.get('Access-Control-Request-Method') || '' ]     // for simplicity we copy the values from the request
      ]
    });
  } else {                            // Simple request and request after successful preflight requests
    //console.log(`cors ${request.method} ${request.nextUrl.pathname} `);
    return NextResponse.next({        // continue in request chain
      headers: [
        [ 'Access-Control-Allow-Origin', origin ]
      ],
      request: {
        headers: requestHeaders,
      },
    })
  }
}

