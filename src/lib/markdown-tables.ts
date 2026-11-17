import { defineHastPlugin } from 'satteri';

export default function markdownTables() {
  let label = '表';

  return defineHastPlugin({
    name: 'accessible-tables',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'th'],
      visit(node, context) {
        if (/^h[1-6]$/.test(node.tagName)) {
          label =
            context.textContent(node).replace(/\s+/g, ' ').trim() || label;
          return;
        }

        if (node.tagName === 'th') {
          const section = context.parent(context.parent(node));
          if (
            section?.type === 'element' &&
            section.tagName === 'thead' &&
            node.properties.scope === undefined
          ) {
            context.setProperty(node, 'scope', 'col');
          }
          return;
        }

        const caption = node.children.find(
          (child) => child.type === 'element' && child.tagName === 'caption',
        );
        const captionText = caption
          ? context.textContent(caption).replace(/\s+/g, ' ').trim()
          : '';
        context.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['table-scroll'],
            role: 'region',
            tabIndex: 0,
            ariaLabel: captionText || label,
          },
          children: [],
        });
      },
    },
  });
}
