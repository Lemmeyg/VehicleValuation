// Jest manual mock for lib/markdown — avoids loading ESM-only unified package.
export const markdownToHtml = jest.fn().mockResolvedValue('<p>mock</p>')
export const markdownToHtmlSync = jest.fn().mockReturnValue('<p>mock</p>')
