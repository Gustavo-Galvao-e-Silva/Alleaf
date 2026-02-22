import { SignIn } from "@clerk/nextjs";
import styles from "./page.module.css";

export default function SignInPage() {
  return (
    <>
      <div className={styles.bg} />
      <div className={styles.container}>
        <SignIn signUpUrl="/sign-up" forceRedirectUrl="/onboarding" />
      </div>
    </>
  );
}
