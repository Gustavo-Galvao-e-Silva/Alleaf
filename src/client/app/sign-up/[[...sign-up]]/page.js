import { SignUp } from "@clerk/nextjs";
import styles from "./page.module.css";

export default function SignUpPage() {
  return (
    <>
      <div className={styles.bg} />
      <div className={styles.container}>
        <SignUp signInUrl="/sign-in" forceRedirectUrl="/onboarding" />
      </div>
    </>
  );
}
