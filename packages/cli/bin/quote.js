#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerInquiryCommands } from '../src/commands/inquiry.mjs';
import { registerReplyCommands } from '../src/commands/reply.mjs';
import { registerCompareCommand } from '../src/commands/compare.mjs';
import { registerOrderCommands } from '../src/commands/order.mjs';
import { registerConfigCommands } from '../src/commands/config.mjs';
import { registerLoginCommands } from '../src/commands/login.mjs';
import { registerInstallCommand } from '../src/commands/install.mjs';
import { registerRemoveCommand } from '../src/commands/remove.mjs';

const { version } = createRequire(import.meta.url)('../package.json');

const program = new Command();

program
  .name('quote')
  .description('通用询报价 CLI 工具')
  .version(version);

registerInstallCommand(program);
registerRemoveCommand(program);
registerInquiryCommands(program);
registerReplyCommands(program);
registerCompareCommand(program);
registerOrderCommands(program);
registerConfigCommands(program);
registerLoginCommands(program);

program.parse();
