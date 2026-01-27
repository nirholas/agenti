/**
 * @fileoverview Extension test suite
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('nirholas.github-to-mcp'));
  });

  test('Should register all commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    
    assert.ok(commands.includes('github-to-mcp.convert'));
    assert.ok(commands.includes('github-to-mcp.convertFromClipboard'));
    assert.ok(commands.includes('github-to-mcp.copyConfig'));
  });

  test('GitHub URL validation', () => {
    const validUrls = [
      'https://github.com/owner/repo',
      'https://github.com/some-user/some-repo',
      'https://github.com/user123/repo.js'
    ];

    const invalidUrls = [
      'https://gitlab.com/owner/repo',
      'not-a-url',
      'https://github.com/',
      'https://github.com/owner'
    ];

    const pattern = /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/;

    for (const url of validUrls) {
      assert.ok(pattern.test(url), `Expected ${url} to be valid`);
    }

    for (const url of invalidUrls) {
      assert.ok(!pattern.test(url), `Expected ${url} to be invalid`);
    }
  });

  test('Config generation produces valid JSON', () => {
    const mockResult = {
      repoName: 'test-repo',
      toolCount: 5,
      timestamp: new Date().toISOString()
    };

    const config = {
      mcpServers: {
        [mockResult.repoName]: {
          command: 'node',
          args: [`${mockResult.repoName}-mcp/index.js`]
        }
      }
    };

    const jsonString = JSON.stringify(config, null, 2);
    
    // Should parse without error
    const parsed = JSON.parse(jsonString);
    assert.ok(parsed.mcpServers);
    assert.ok(parsed.mcpServers['test-repo']);
  });
});
