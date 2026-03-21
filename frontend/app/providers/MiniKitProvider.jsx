"use client";
import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect } from "react";

export default function MiniKitProvider({ children }) {
  useEffect(() => {
    MiniKit.install(process.env.NEXT_PUBLIC_WLD_APP_ID);
  }, []);
  return children;
}
