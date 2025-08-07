// lib/convex.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CONVEX_URL } from "astro:env/client";
import type { FunctionComponent, JSX } from "react";

const client = new ConvexReactClient(CONVEX_URL);

// Props must extend JSX.IntrinsicAttributes to satisfy React typings
export function withConvexProvider<P extends JSX.IntrinsicAttributes>(
    Component: FunctionComponent<P>
): FunctionComponent<P> {
    return function WithConvexProvider(props: P) {
        return (
            <ConvexProvider client={client}>
                <Component {...props} />
            </ConvexProvider>
        );
    };
}
