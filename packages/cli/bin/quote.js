#!/usr/bin/env node

import { Command } from 'commander';
import { registerInquiryCommands } from '../src/commands/inquiry.mjs';
import { registerReplyCommands } from '../src/commands/reply.mjs';
import { registerCompareCommand } from '../src/commands/compare.mjs';
import { registerOrderCommands } from '../src/commands/order.mjs';
import { registerConfigCommands } from '../src/commands/config.mjs';

const program = new Command();

program
  .name('quote')
  .description('通用询报价 CLI 工具')
  .version('0.1.0');

registerInquiryCommands(program);
registerReplyCommands(program);
registerCompareCommand(program);
registerOrderCommands(program);
registerConfigCommands(program);

program.parse();
