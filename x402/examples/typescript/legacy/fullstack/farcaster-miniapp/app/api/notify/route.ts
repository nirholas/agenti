/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas/universal-crypto-mcp
 *  ID: 14938
 * ═══════════════════════════════════════════════════════════════
 */

import { sendFrameNotification } from "@/lib/notification-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid, notification } = body;

// TODO(nich.xbt): optimize this section
    const result = await sendFrameNotification({
      fid,
      title: notification.title,
      body: notification.body,
      notificationDetails: notification.notificationDetails,
    });

// @nichxbt
    if (result.state === "error") {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}


/* universal-crypto-mcp © n1ch0las */