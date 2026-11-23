// The start page `/` (FR-8, FR-50, AD-20, Story 9.6): the demo front page on the public deployment
// (FEATURE_DEMO on, no session), else the saved-plans list. The flags come from GET /api/session at
// runtime, so HomePage decides on the client. Demo version reaches the front page as a slot, so
// modules/front-page never imports modules/auth.

import { DemoVersionButton } from "@/modules/auth/demo-version-button";
import { HomePage } from "@/modules/front-page/home-page";

export default function Page() {
  return <HomePage demoAction={<DemoVersionButton />} />;
}
