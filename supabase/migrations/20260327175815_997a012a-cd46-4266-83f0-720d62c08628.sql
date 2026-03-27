INSERT INTO public.user_approvals (user_id, email, status, approved_at)
VALUES
  ('3c89e15f-7481-46b4-92f7-d8852fe11dee', 'colby.edwards77@gmail.com', 'approved', now()),
  ('4abbcae7-09d7-4c29-a493-cabf5c91d1a1', 'hawkscoachmatt@gmail.com', 'approved', now()),
  ('d187be3a-7e1c-4a6d-9db4-634716e93fb4', 'bsorochan@yahoo.com', 'approved', now()),
  ('69930aba-ef07-4ac5-8432-b2701151cbcb', 'daitchison@reliancecomfort.com', 'approved', now()),
  ('c2eae42b-6155-4f64-aba1-68ba2cb7c5c5', 'jdrperry@rogers.com', 'approved', now()),
  ('633ae572-cb2d-49fa-933d-d69442d1977c', 'mfparkinson@gmail.com', 'approved', now()),
  ('9a326614-5637-4b80-afbd-d6b3c30e1a3b', 'woodsmanac@gmail.com', 'approved', now()),
  ('00fc0515-02f8-4807-8674-5a1e49c945f9', 'woodsmanac@yahoo.com', 'approved', now())
ON CONFLICT (user_id) DO UPDATE SET status = 'approved', approved_at = now();