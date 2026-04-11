import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** B2CCoop Facebook Messenger (payment inquiries). */
export const MESSENGER_PAYMENT_CHAT_URL = "https://m.me/278382175357935";

/**
 * QR code that opens the Messenger chat URL when scanned with a phone camera.
 */
export function MessengerPaymentQr() {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(MESSENGER_PAYMENT_CHAT_URL, {
      width: 240,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dataUrl) {
    return (
      <div
        className="mx-auto h-[240px] w-[240px] rounded-xl border-2 border-slate-200 bg-slate-100"
        aria-busy="true"
        aria-label="Loading QR code"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Scan with your phone to open Facebook Messenger and chat with B2CCoop"
      width={240}
      height={240}
      className="mx-auto rounded-xl border-2 border-slate-200 bg-white p-2 shadow-sm"
    />
  );
}
