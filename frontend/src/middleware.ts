import { NextResponse, type NextRequest } from 'next/server';

// CV sprint: feed / networking features are switched off. Set NEXT_PUBLIC_CV_ONLY=false to restore them.
const CV_ONLY = process.env.NEXT_PUBLIC_CV_ONLY !== 'false';

export function middleware(req: NextRequest) {
  if (CV_ONLY) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/connections/:path*', '/my-connections/:path*', '/messages/:path*', '/notifications/:path*'],
};
