import { NextResponse } from "next/server";
import z from "zod";

export const POST = async (request: Request) => {
  const args = z
    .object({
      a: z.number(),
      b: z.number(),
    })
    .parse(await request.json());

  return NextResponse.json({
    result: args.a + args.b,
  });
};
