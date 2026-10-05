// CSS module compiled from action-group.module.less for the local dependency.
const styles = {
  actionGroup: 'react-ui-action-group',
  actionBtn: 'react-ui-action-button',
  divider: 'react-ui-action-divider',
  moreBtn: 'react-ui-action-more',
};
if (typeof document !== 'undefined' && !document.getElementById('react-ui-action-group-style')) {
  const style = document.createElement('style');
  style.id = 'react-ui-action-group-style';
  style.textContent = '.react-ui-action-group{display:inline-flex;align-items:center;flex-wrap:nowrap}.react-ui-action-button{padding:0 4px}.react-ui-action-more{padding:0 4px;gap:4px}';
  document.head.appendChild(style);
}
export default styles;
