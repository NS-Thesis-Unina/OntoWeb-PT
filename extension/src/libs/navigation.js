export const selectedSection = (pathname, section) => {
  if (pathname.includes(`/${section}`)) {
    return true;
  }
  return false;
}

export const selectedSubSection = (pathname, section, subSection) => {
  if (!subSection) {
    return pathname === `/${section}` || pathname === `/${section}/`;
  }
  return pathname.includes(`/${section}/${subSection}`);
};