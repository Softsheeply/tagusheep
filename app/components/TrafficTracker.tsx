"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { doc, increment, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const VISITOR_KEY = "tagsheep_visitor_id";
const INTERNAL_PATHS = ["/tools", "/capture", "/trash", "/export", "/imports-review", "/submissions-review"];

function visitorId() {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export default function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || INTERNAL_PATHS.some((prefix) => pathname.startsWith(prefix))) return;

    const id = visitorId();
    const day = utcDay();
    const ref = doc(db, "traffic_visitors", `${day}_${id}`);

    void runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) {
        transaction.update(ref, {
          lastSeenAt: serverTimestamp(),
          views: increment(1),
          paths: Array.from(new Set([...(snapshot.data().paths || []), pathname])).slice(0, 100),
        });
      } else {
        transaction.set(ref, {
          visitorId: id,
          day,
          firstSeenAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          views: 1,
          paths: [pathname],
        });
      }
    }).catch(() => {
      // Analytics should never interrupt browsing if storage is unavailable.
    });
  }, [pathname]);

  return null;
}
