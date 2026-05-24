import { NextRequest, NextResponse } from "next/server";

const STOREFRONT_QUERY = `
  query searchProducts($query: String!, $first: Int!) {
    products(query: $query, first: $first) {
      edges {
        node {
          id
          title
          handle
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query || query.trim() === "") {
    return NextResponse.json({ products: [] });
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_DOMAIN}/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token":
          process.env.SHOPIFY_STOREFRONT_TOKEN!,
      },
      body: JSON.stringify({
        query: STOREFRONT_QUERY,
        variables: { query, first: 5 },
      }),
    }
  );

  const data = await res.json();
  const edges = data?.data?.products?.edges ?? [];

  const products = edges.map(({ node }: any) => ({
    title: node.title,
    handle: node.handle,
    url: `/products/${node.handle}`,
    price: node.priceRange.minVariantPrice.amount,
    currency: node.priceRange.minVariantPrice.currencyCode,
    variants: node.variants.edges.map(({ node: v }: any) => ({
      title: v.title,
      available: v.availableForSale,
      options: v.selectedOptions,
    })),
  }));

  return NextResponse.json({ products });
}
