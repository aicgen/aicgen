/** Remove a leading YAML frontmatter block. */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '');
}

/** Read the `description:` value from a leading frontmatter block. */
export function readFrontmatterDescription(content: string): string {
  const match = content.match(/^description:\s*"?(.+?)"?\s*$/m);
  return match ? match[1] : '';
}
