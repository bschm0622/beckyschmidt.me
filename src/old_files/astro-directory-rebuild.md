---
title: "Why I rebuilt my podcast directory with Astro"
pubDate: 2025-05-30
description: "I recently rebuilt my podcast directory from Next.js to Astro to improve performance and simplify my stack. In this post, I walk through my setup with Supabase, share where I got stuck (and how I fixed it), and reflect on what I learned."
author: Becky Schmidt
tags: ["astro"]
slug: astro-directory-rebuild
---
This post is a bit of a departure from my usual product management content. Consider it a “build in public” log of one of my side projects: coding (with AI help) a podcast directory called [Wellspring Archive](http://wellspringarchive.com).

Over the past six months, I’ve been learning to code with help from AI tools. One trend I kept seeing was people building website directories, for good reason:

1. They’re a great crash course in building real websites  
2. Once the content is generated, they require minimal upkeep  
3. They have clear potential for passive income

Two creators I found especially helpful were [Frey Chu](https://www.youtube.com/@FreyChu) and [Jordan Urbs](https://www.youtube.com/@jordanurbsAI), who both share a lot on this topic.

I decided to build a directory focused on a niche I personally care about: Christian podcasts. In this post, I’ll share how I approached building it from scratch \- no templates, no WordPress, no website builders. I’ll walk through what I learned starting with [Next.js](https://nextjs.org/), why I switched to [Astro](https://astro.build/), and how I solved some tricky technical problems along the way.

If you’re a "vibe coder" (or just learning by building), I hope this helps.

## Table of contents

## Intro: Why I decided to rebuild my entire site with Astro

At a high level, there are two common ways to render web pages: server-side rendering (SSR) and static site generation (SSG).

Originally, my podcast directory was built with Next.js, which has become the go-to framework for AI-assisted coding. It leans heavily on SSR, meaning every time someone visits the site, a request is sent to the server to dynamically build the page. In contrast, SSG builds the pages ahead of time and serves them as static files. For content-heavy, mostly unchanging websites (like blogs, directories, or landing pages) SSG is almost always the better option. SSR is better when you are creating web applications with dynamically changing data.

There were two main reasons I decided to move my site over to Astro:

First, the code is much easier to understand. After six months of building alongside AI, I’ve picked up a solid foundation of web development basics, and I want to be able to read, modify, and maintain my own codebase. Astro’s simpler framework makes that much easier, which helps with debugging and long-term upkeep.

Second, static sites are much faster. That matters both for SEO and for user experience. There’s really no need for a mostly static site like mine to be SSR \- doing so just adds bloat and slows things down. I suspect the reason AI (specifically Cursor) defaulted to Next.js in the first place was because I also use Supabase as the backend for my listings, but more on that later.

## Database challenges

I use Supabase in two main ways on my podcast directory:

1. To store the content of the site, powering a programmatic directory instead of manually creating pages for each listing
2. To manage listings through a simple admin interface (adding, updating, and deleting entries) without needing to work directly in Supabase

This setup introduced some challenges when switching to Astro.

Unlike Next.js, Astro doesn’t let you pull live data from your database during the build in the same way. Since everything is pre-rendered by default, I had to fetch my data ahead of time by saving it to a JSON file and then import it into the pages. In Next.js, I was used to just grabbing data during the build step, so this extra step in Astro took some getting used to.

The admin side was also a shift. With Next.js, I could load fresh data on each visit without much setup. In Astro, since everything is static by default, I had to handle data loading differently — fetching it in the browser instead of on the server. It works just fine, but it feels more like building a little web app inside a static site.

Lastly, I had to consider how to display live podcast RSS data, which can change frequently and should be able to update as the RSS feed is updated, on demand.

## **Solutions**

### **1\. Statically Generated Data from the Database**

To preserve the benefits of static rendering with Astro, I had to approach database integration differently than I was used to with Next.js. By sharing all the errors I was getting with ChatGPT, I got to a working version that I'll explain below.

Instead of querying the database at build time (which isn’t allowed in static Astro builds), I generate local `.json` files with all the data I need ahead of time. Then, I reference those files in my pages, keeping the build fast and secure.

#### **Fetch and Save Data Before Build**

I created a custom script that runs before the site is built. This script connects to Supabase, fetches all the data I need, and saves it as local JSON files in `src/data/`. Here's a simplified version:

```ts
import fs from 'fs/promises'  
import path from 'path'  
import dotenv from 'dotenv'  
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const API_URL = process.env.SUPABASE_URL || ''  
const API_KEY = process.env.SUPABASE_KEY || ''  
const client = createClient(API_URL, API_KEY)

async function fetchData() {  
  const { data, error } = await client.from('your_table').select('*').order('name')  
  if (error) throw new Error(Error fetching data: ${error.message})  
  return data  
}

async function writeJson(filename: string, data: unknown) {  
  const dataDir = path.join(process.cwd(), 'src', 'data')  
  await fs.mkdir(dataDir, { recursive: true })  
  await fs.writeFile(path.join(dataDir, filename), JSON.stringify(data, null, 2))  
}

async function run() {  
  const items = await fetchData()  
  await writeJson('items.json', items)  
  const slugs = items.map((item: any) => item.slug)  
  await writeJson('item-slugs.json', slugs)  
}

run()  
```

#### **Import JSON Data in Astro Pages**

Instead of querying Supabase directly in your Astro components, you simply import your pre-generated JSON like this:
```ts
import items from '../data/items.json'  
```

This keeps your static build compliant with Astro, while still pulling data from your database.

#### **AI Prompt Example**

Here’s a prompt you can share with your AI assistant to get help building this:

```
I’m building a static site with Astro that pulls data from a database like Supabase.
I want to:

1. Fetch all public data before build time using a secure script.  
2. Save that data as .json files in src/data/...  
3. Use those files in Astro components/pages.  
4. Avoid exposing secrets or querying the database at runtime.

Can you help with a script example and guidance on integrating this safely?  
```

### **2\. Dynamic Data for the Admin Portal**

Astro defaults to static rendering, but some pages, like my admin dashboard, need to stay dynamic. Here's how I handled that.

#### **Mark Pages as Dynamic**

In the frontmatter of each admin page, I added:
```ts
export const prerender = false;  
```

This tells Astro to render the page on-demand using server-side rendering.

#### **Enable SSR in Your Adapter**

If you're using [Vercel](https://vercel.com/docs/frameworks/astro), make sure the Astro Vercel adapter is set up to support SSR in your Astro config file. This allows dynamic pages to work properly on the platform.

#### **Querying the Database in SSR Pages**

Now you can safely query Supabase in your server-rendered pages:

```ts
async function getTableData(tableName: string, orderByField = 'id') {  
  const supabase = getSupabaseClient()  
  const { data, error } = await supabase.from(tableName).select('*').order(orderByField)  
  if (error) {  
    console.error(Error fetching ${tableName}:, error.message)  
    return null  
  }  
  return data  
}  
```

#### **AI Prompt Example**

Here’s a prompt to help you set up protected, dynamic admin pages:
```
I’m building an admin route in a web app using Supabase (with database + auth) and Astro. I want to:

1. Protect the route so only logged-in users can access it.  
2. Fetch live data from the database in an async function.  
3. Handle errors and return data securely.

Can you show me an example that fits this setup?  
```

### **3\. Dynamic Data from RSS Feeds**

Some parts of the site, like the latest podcast episodes, need to be fresh. But instead of making the *whole page* dynamic, I used a hybrid approach:

* Each podcast listing includes a small dynamic component (e.g., a box showing the most recent episode).
* On the podcast detail page, I show the 5 most recent episodes using dynamic data from the RSS feed.

To enable this, I again used this script in the component:
```ts
export const prerender = false; 
```


In order to have the component server-side rendered within a static page,
I made use of one of another cool Astro feature: [Server Islands](https://docs.astro.build/en/guides/server-islands/).

The idea behind server islands is that you may only need to render a small
section of the page with dynamic content. Rather than forcing the whole page to be server-side, you can create a little "island" that fetches data dynamically, while leaving the rest of the page statically generated.

After creating my server-rendered RSS feed component, I was able to inject it into my page like this:
```astro
---
import LatestPodcast from '../components/LatestPodcast.astro';
import FallbackLatestPodcast from '../components/FallbackLatestPodcast.astro';
---
<LatestPodcast server:defer>
  <FallbackLatestPodcast slot="fallback" />
</LatestPodcast>
```

By adding `server:defer` I'm telling the attribute to delay until it's rendered. And you can also add a fallback loading state while you wait for rendering for a nicer user experience with another component and `slot="fallback"`.

Overall, it's a very nice experience for the user where I can always fetch the most recent podcast from the RSS feed without having to rebuild my site every time, but the rest of the site is statically generated and loads super quick.

This is another thing that Cursor didn't really know about. I actually ended up implementing this myself without the help of AI, by watching [this video](https://www.youtube.com/watch?v=Tee9GJsnvKc) from *Coding in Public*, where he actually does the same exact RSS feed embedding, but with YouTube videos instead. I suspect that the reason why AI wasn't able to get me 100% of the way there with Server Islands is because this feature was just experimentally released in [July 2024](https://astro.build/blog/astro-4120/) and then made generally available in September 2024 with the [Astro 5](https://astro.build/blog/astro-5-beta/#stable-server-islands) release. So presumably this will not be an issue within the next year, but something to be aware of when you're using a framework that updates as frequently as Astro does with new, useful features.

#### **Tradeoff: SEO vs. Freshness**

Dynamic content rendered only on the client may not be fully crawlable by search engines, which can hurt SEO. 

To keep your site SEO-friendly, pre-render as much content as possible and limit client-side rendering to non-critical parts where freshness matters most.

## **Downsides of Astro \+ Supabase directory setup**

There are two main downsides to using Astro, as opposed to SSR with Next.js, while also using Supabase as your database for listings:

1. **Every database change requires a full site redeploy.**  
    Since the data is statically fetched during build time, you won’t see changes in production until the site is rebuilt and redeployed. This is very different from Next.js, where dynamic SSR means any changes in the database are reflected immediately without a re-deploy.  
2. **The setup is more complex than expected.**  
    Because Astro doesn’t support SSR in the same way, and because I’m not a developer, I initially struggled to understand why my changes weren’t showing up. It took a bit of digging to realize the root cause, but now that I get it, I know how to set things up correctly in the future.

## **Final Thoughts**

Now that the basic rebuild is done, I’m still really glad I migrated to Astro.

Before, my PageSpeed score hovered in the 70s, meaning my site loaded slowly (often several seconds) because it was fetching data live from the database on every request. Now, after rebuilding, my PageSpeed score is consistently **96**, and the site loads almost instantly. This improvement is crucial because, according to Google, 53% of mobile users will abandon a page if it takes longer than 3 seconds to load.

I’m also glad I was able to move the admin portal over to Astro. At one point, I considered keeping it in Next.js on a subdomain, but having everything in a single codebase and framework has made managing the project much simpler. Plus, I still have a user-friendly interface to create, edit, and delete listings without any hassle.

Rebuilding this podcast directory with Astro and Supabase turned out to be more than just a casual “vibe coding” project. It pushed me, taught me a lot about how web rendering really works, and I’m genuinely happy with how it turned out.

This kind of setup didn’t come ready-made, even with tools like Cursor. I had to figure out many things the hard way. But honestly, that process was worth it. If you’re building something similar, especially solo or as a side project, these challenges are exactly what help you level up. It’s easy to think you’ve messed something up, but often the tools just don’t fit your use case perfectly from the start. Once you get *why* things work the way they do, everything clicks, and you’ll be more confident next time.

If you’re planning to build a programmatic directory with Astro and a database, I hope this post helps you avoid some of the pitfalls I ran into!