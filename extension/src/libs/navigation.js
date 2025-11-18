/**
 * Navigation Helpers
 *
 * Small utilities used by the Navbar and layout components to determine
 * which primary section or subsection is currently selected based on
 * the router pathname.
 *
 * These utilities support:
 * - button highlighting
 * - button disabling
 * - dynamic route-aware UI behavior
 */

/**
 * Determines whether the main section is active.
 *
 * Example:
 *   selectedSection("/techstack/analyze", "techstack") → true
 *
 * @param {string} pathname - Current browser/React Router path.
 * @param {string} section - Target section name (e.g., "analyzer").
 * @returns {boolean}
 */
export const selectedSection = (pathname, section) => {
  return pathname.includes(`/${section}`);
};

/**
 * Determines whether a subsection is active.
 *
 * Behavior:
 * - If `subSection` is omitted → check whether the pathname matches the section root.
 * - If `subSection` is provided → check whether pathname contains /section/subSection.
 *
 * @param {string} pathname
 * @param {string} section - Primary section name.
 * @param {string} [subSection] - Optional subsection name.
 * @returns {boolean}
 */
export const selectedSubSection = (pathname, section, subSection) => {
  if (!subSection) {
    // Matches root: "/analyzer" or "/analyzer/"
    return pathname === `/${section}` || pathname === `/${section}/`;
  }

  return pathname.includes(`/${section}/${subSection}`);
};
