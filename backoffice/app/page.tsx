import { redirect } from "next/navigation";

/** The backoffice has no landing page — staff want the fulfilment queue. */
export default function Home() {
  redirect("/orders");
}
