import { NextResponse } from "next/server";
import { verifyCloudProof } from "@worldcoin/minikit-js";

export async function POST(req) {
  try {
    const { proof, action, signal } = await req.json();

    const appId = process.env.NEXT_PUBLIC_WLD_APP_ID;
    const result = await verifyCloudProof(proof, appId, action, signal);

    if (result.success) {
      return NextResponse.json({
        success: true,
        nullifier_hash: proof.nullifier_hash,
      });
    }

    return NextResponse.json(
      { success: false, error: result.detail ?? "Verification failed" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
