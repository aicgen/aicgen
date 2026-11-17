import { SubAgentGenerator } from '../subagent-generator.js';

function frontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match).not.toBeNull();
  return Object.fromEntries(
    match![1].split('\n').map(line => {
      const index = line.indexOf(':');
      return [line.slice(0, index), line.slice(index + 1).trim()];
    })
  );
}

describe('SubAgentGenerator', () => {
  const ids = ['architecture/microservices/boundaries', 'security/injection'];

  it('emits only valid Claude Code subagent frontmatter', async () => {
    const agents = await new SubAgentGenerator().generateSubAgents(ids, 'full');

    expect(agents.map(a => a.name).sort()).toEqual(['architecture-reviewer', 'guideline-checker', 'security-auditor']);
    for (const agent of agents) {
      const fm = frontmatter(agent.content);
      expect(Object.keys(fm).sort()).toEqual(['description', 'model', 'name', 'tools']);
      expect(fm.name).toBe(agent.name);
      expect(fm.tools).toContain('Read');
      expect(fm.model).not.toMatch(/claude-(opus|sonnet)-4/);
    }
  });

  it('does not generate agents below full level', async () => {
    await expect(new SubAgentGenerator().generateSubAgents(ids, 'standard')).resolves.toEqual([]);
  });

  it('does not nest the agent frontmatter inside generated skills', async () => {
    const skills = await new SubAgentGenerator().generateSkills(ids, 'full');

    expect(skills.length).toBe(3);
    for (const skill of skills) {
      expect(skill.content.match(/^---$/gm)).toHaveLength(2);
      expect(skill.content).not.toContain('tools: Read');
    }
  });
});
