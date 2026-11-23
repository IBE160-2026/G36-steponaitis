import { SignupPage } from "@/modules/auth/signup-page";

// Create account (Story 9.1, FR-39). With FEATURE_AUTH off the page renders Next's 404.
export default function Page() {
  return <SignupPage />;
}
