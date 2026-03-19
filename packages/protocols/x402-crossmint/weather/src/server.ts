import express, { Request, Response } from "express";
import type { Address } from "viem";
import axios from "axios";
import { paymentMiddleware } from "x402-express";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3100;
const payTo = (process.env.PAY_TO || "0x0000000000000000000000000000000000000000") as Address;

app.use(paymentMiddleware(payTo, {
  "GET /weather": { price: "$0.001", network: "base-sepolia" }
}));

app.get("/weather", async (req: Request, res: Response) => {
  const city = (req.query.city as string) || "San Francisco";
  try {
    // Geocode city name to lat/lon using Open-Meteo's free geocoding API
    const geo = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const first = geo.data?.results?.[0];
    if (!first) {
      return res.status(404).json({ error: "City not found" });
    }
    const { latitude, longitude, name, country } = first;

    // Fetch current temperature
    const m = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`
    );

    const data = {
      city: name || city,
      country,
      latitude,
      longitude,
      temperatureC: m.data?.current?.temperature_2m
    };

    res.json({ weather: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`weather-402 server listening on http://localhost:${port}`);
});


