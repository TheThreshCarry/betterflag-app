import pino from "pino"

const isProduction = process.env.NODE_ENV === "production"

const transport = isProduction
  ? pino.transport({
      targets: [
        {
          target: "pino/file",
          options: { destination: 1 },
        },
        ...(process.env.BETTER_STACK_SOURCE_TOKEN
          ? [
              {
                target: "@logtail/pino",
                options: {
                  sourceToken: process.env.BETTER_STACK_SOURCE_TOKEN,
                  options: {
                    endpoint: process.env.BETTER_STACK_LOGS_ENDPOINT,
                  },
                },
              },
            ]
          : []),
      ],
    })
  : pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    })

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  },
  transport,
)

export function createLogger(service: string) {
  return logger.child({ service })
}

export default logger
