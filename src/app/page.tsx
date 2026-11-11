import { Landing } from "@/components/landing";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Landing
      paypalReady={
        !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
      }
    />
  );
}
