import { LoginPage } from "@/modules/auth/login-page";

// Log in (Story 9.2, FR-40). With FEATURE_AUTH off the page renders Next's 404.
export default function Page() {
  return <LoginPage />;
}
