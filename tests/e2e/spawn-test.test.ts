import { describe, it, expect } from "vitest"
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"

describe("test transport env", () => {
  it("should check merged env", () => {
    const defaultEnv = getDefaultEnvironment()
    const userEnv = { ...process.env, NODE_ENV: "test", LOG_LEVEL: "ERROR" }
    const merged = { ...defaultEnv, ...userEnv }
    
    // Check if there's a difference in PATH
    console.log("process.env.PATH length:", process.env.PATH?.length)
    console.log("defaultEnv.PATH length:", defaultEnv.PATH?.length)
    console.log("merged.PATH length:", merged.PATH?.length)
    
    // Are they the same?
    console.log("PATH same:", process.env.PATH === merged.PATH)
    
    // Check NODE_ROOT
    console.log("NODE_ROOT:", merged.NODE_ROOT)
    
    expect(true).toBe(true)
  })
})
