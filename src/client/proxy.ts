import { clerkMiddleware, clerkClient, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

interface UserMetadata {
  onboardingComplete?: boolean;
}

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);
const isApiRoute = createRouteMatcher(['/api/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Not signed in → redirect to sign-in (unless already on a public route)
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Skip metadata check for API routes (avoids redirect loops on /api/onboarding-complete)
  if (!userId || isApiRoute(req)) return;

  // Read publicMetadata directly from the user object — always up-to-date, no JWT lag
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = (user.publicMetadata ?? {}) as UserMetadata;

  // Signed in but onboarding not complete → force to /onboarding
  if (!metadata.onboardingComplete && !isOnboardingRoute(req) && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Signed in and onboarding done but trying to hit /onboarding → send to app
  if (metadata.onboardingComplete && isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};