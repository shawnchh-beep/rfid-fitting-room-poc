graph LR
    A[Frontend/UI: HTML5, CSS3, Vanilla JS/React] --> B(Vercel Hosting/Deployment)
    B --> C(Supabase: PostgreSQL, PostgREST API, Realtime Subscriptions)
    B --> D(Vercel Serverless Functions)
    C --> D
    D --> C
    E[GitHub Source Control] --> B