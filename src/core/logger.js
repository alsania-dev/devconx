import { Console } from 'node:console';
import { Writable } from 'node:stream';

/** @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel */

const levelPriority = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  #console;
  #threshold;

  /**
   * @param {LogLevel} [level]
   * @param {Writable} [output]
   */
  constructor(level = 'info', output = process.stdout) {
    this.#console = new Console({ stdout: output, stderr: output });
    this.#threshold = level;
  }

  /** @param {string} message @param {unknown} [payload] */
  debug(message, payload) {
    this.#log('debug', message, payload);
  }

  /** @param {string} message @param {unknown} [payload] */
  info(message, payload) {
    this.#log('info', message, payload);
  }

  /** @param {string} message @param {unknown} [payload] */
  warn(message, payload) {
    this.#log('warn', message, payload);
  }

  /** @param {string} message @param {unknown} [payload] */
  error(message, payload) {
    this.#log('error', message, payload);
  }

  #log(level, message, payload) {
    if (levelPriority[level] < levelPriority[this.#threshold]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (payload !== undefined) {
      this.#console.log(base, payload);
    } else {
      this.#console.log(base);
    }
  }
}
