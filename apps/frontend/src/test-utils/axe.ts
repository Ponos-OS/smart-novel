import axe from 'axe-core';

/**
 * @description What axe finds wrong in a rendered component, one line per problem. Contrast is not checked (jsdom has no layout, so it cannot be), and neither are the rules about a whole page (landmarks, a level-one heading), which a component cannot satisfy on its own.
 */
export async function a11yViolations(
  container: Element,
): Promise<string[]> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });

  return results.violations.map(
    ({ id, help, nodes }) =>
      `${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
}
