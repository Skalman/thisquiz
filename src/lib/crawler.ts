/** Search-engine and link-preview crawlers, by their user agents. */
const CRAWLER_AGENT = /bot|crawler|spider|slurp|facebookexternalhit|embedly/i;

/** Whether the visitor is a crawler, which sees the page as a returning visitor would. */
export function isCrawler(): boolean {
  return CRAWLER_AGENT.test(navigator.userAgent);
}
