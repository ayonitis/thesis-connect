-- Development only: disable the temporary faculty review-write pause trigger.
ALTER TABLE ONLY public.faculty_reviews
  DISABLE TRIGGER tc_review_pause;
