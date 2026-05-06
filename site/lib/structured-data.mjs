// schema.org JSON-LD builders for the four page types that benefit from
// structured data:
//
//   - personSchema       → home + about (identity + knowledge-panel signals)
//   - webSiteSchema      → home (sitewide identity)
//   - articleSchema      → each post (rich-result eligibility, byline, dates)
//   - imageGallerySchema → each gallery (image-search eligibility)
//
// All builders return a JSON-stringified object ready to embed inside a
// `<script type="application/ld+json">…</script>` block. Output passes
// through `safeJsonForScript()` which prevents `</script>` substrings from
// breaking out of the surrounding script tag.

// Hard-coded sitewide identity. Single-author personal site, so no need to
// thread these through the build context. If/when authorship gets more
// complicated, refactor to accept a Person object as a parameter instead.
const PERSON_NAME = "Nikolai Nekrutenko";
const PERSON_JOB_TITLE = "Avionics Hardware Development Engineer";
const PERSON_WORKS_FOR = {
  "@type": "Organization",
  name: "Varda Space Industries",
  url: "https://varda.com",
};
const PERSON_ALUMNI_OF = {
  "@type": "EducationalOrganization",
  name: "Cornell University",
  url: "https://www.cornell.edu/",
};
const PERSON_SAME_AS = [
  "https://www.linkedin.com/in/nikolai-nekrutenko/",
  "https://github.com/nekrutnikolai",
  "https://www.youtube.com/channel/UC-WSQ21Q2Q36urFPc4e5T6Q",
];

// `</script>` inside JSON-LD would close the wrapping <script> tag and let
// the rest of the JSON leak into the document body. Replace `</` with `<\/`
// (legal escape inside JSON strings) so any user-supplied title/description
// containing the substring is rendered safely.
function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/<\//g, "<\\/")
}

function person({ siteUrl, profileImageUrl }) {
  return {
    "@type": "Person",
    name: PERSON_NAME,
    url: `${siteUrl}/about/`,
    ...(profileImageUrl ? { image: profileImageUrl } : {}),
    jobTitle: PERSON_JOB_TITLE,
    worksFor: PERSON_WORKS_FOR,
    alumniOf: PERSON_ALUMNI_OF,
    sameAs: PERSON_SAME_AS,
  };
}

export function personSchema({ siteUrl, profileImageUrl } = {}) {
  return safeJsonForScript({
    "@context": "https://schema.org",
    ...person({ siteUrl, profileImageUrl }),
  });
}

export function webSiteSchema({ siteUrl, siteName }) {
  return safeJsonForScript({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: `${siteUrl}/`,
    author: {
      "@type": "Person",
      name: PERSON_NAME,
      url: `${siteUrl}/about/`,
    },
  });
}

// Combine WebSite + Person into a single @graph for the home page so both
// entities are emitted in one <script> block — Google's Rich Results test
// recommends @graph for multi-entity pages.
export function homeSchema({ siteUrl, siteName, profileImageUrl }) {
  return safeJsonForScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: siteName,
        url: `${siteUrl}/`,
        author: {
          "@type": "Person",
          name: PERSON_NAME,
          url: `${siteUrl}/about/`,
        },
      },
      person({ siteUrl, profileImageUrl }),
    ],
  });
}

export function articleSchema({
  siteUrl,
  url,
  title,
  dateISO,
  description,
  ogImageUrl,
  tags,
  wordCount,
}) {
  const author = {
    "@type": "Person",
    name: PERSON_NAME,
    url: `${siteUrl}/about/`,
  };
  return safeJsonForScript({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    ...(description ? { description } : {}),
    datePublished: dateISO,
    dateModified: dateISO,
    author,
    publisher: author,
    ...(ogImageUrl ? { image: ogImageUrl } : {}),
    url,
    mainEntityOfPage: url,
    ...(typeof wordCount === "number" && wordCount > 0 ? { wordCount } : {}),
    ...(Array.isArray(tags) && tags.length > 0
      ? { keywords: tags.join(", ") }
      : {}),
  });
}

export function imageGallerySchema({
  siteUrl,
  url,
  title,
  dateISO,
  description,
  images,
}) {
  return safeJsonForScript({
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: title,
    ...(description ? { description } : {}),
    url,
    ...(dateISO ? { datePublished: dateISO } : {}),
    creator: {
      "@type": "Person",
      name: PERSON_NAME,
      url: `${siteUrl}/about/`,
    },
    image: (images || []).map((img) => ({
      "@type": "ImageObject",
      contentUrl: img.contentUrl,
      ...(img.thumbnailUrl ? { thumbnailUrl: img.thumbnailUrl } : {}),
    })),
  });
}
