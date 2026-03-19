import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("weather")
  getWeatherData() {
    return {
      temperature: 72,
      conditions: "sunny",
      message: "Thanks for your payment!",
    };
  }
}
