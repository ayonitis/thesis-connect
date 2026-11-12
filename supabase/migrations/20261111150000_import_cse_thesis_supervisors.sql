-- Source: https://cse.bracu.ac.bd/thesis/supervising/list
-- 254 cards, 252 normalized names. Conflicting metadata for two names is left NULL.
BEGIN;

-- Serialize normalized matching against concurrent manual faculty writes.
LOCK TABLE public.faculty IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE cse_supervisor_import (
  name text NOT NULL,
  designation text,
  email text
) ON COMMIT DROP;

INSERT INTO pg_temp.cse_supervisor_import(name, designation, email) VALUES
  ('Ahammod Munim Ramil', 'Research Assistant', 'munim.ramil@bracu.ac.bd'),
  ('Istiaq Ahmed Fahad', 'Lecturer', 'ahmed.fahad@bracu.ac.bd'),
  ('Mollah Md Saif', 'Research Assistant', 'mollah.mdsaif@bracu.ac.bd'),
  ('Md. Ishrak Ahsan', 'Lecturer', 'ishrak.ahsan@bracu.ac.bd'),
  ('Mahir Labib Dihan', 'Lecturer', 'labib.mahir@bracu.ac.bd'),
  ('Sakib Anwar Rieyan', 'Lecturer', 'sakib.rieyan@bracu.ac.bd'),
  ('Angkon Deb', 'C. Lecturer', 'ext.angkon.deb@bracu.ac.bd'),
  ('Md Toky Tazwar', 'C. Lecturer', 'ext.toky.tazwar@bracu.ac.bd'),
  ('Muhammad Abdur Rahman', 'C. Senior Lecturer', 'abdur.rahman@bracu.ac.bd'),
  ('Anika Afrin', 'C. Lecturer', 'ext.anika.afrin@bracu.ac.bd'),
  ('Ayesha Siddika', 'C. Lecturer', 'ext.ayesha.siddika@bracu.ac.bd'),
  ('Ahmed Akib Jawad Karim', 'Adjunct Lecturer', 'ext.akib.jawad@bracu.ac.bd'),
  ('Abdullah Khondoker', 'C. Lecturer', 'ext.abdullah@bracu.ac.bd'),
  ('Mr. MD FARDIN RAHMAN AMI', 'C. Lecturer', 'ext.fardin.rahman@bracu.ac.bd'),
  ('Md. Irtiza Hossain', 'C. Lecturer', 'ext.irtiza.hossain@bracu.ac.bd'),
  ('Moinul Haque', 'C. Lecturer', 'ext.moinul.haque@bracu.ac.bd'),
  ('MD ASIF', 'C. Lecturer', 'ext.md.asif@bracu.ac.bd'),
  ('Monirul Haque', 'Adjunct Lecturer', 'ext.monirul.haque@bracu.ac.bd'),
  ('Mehnaz Ara Fazal', 'C. Lecturer', 'ext.mehnaz.fazal@bracu.ac.bd'),
  ('Nafiz Imtiaz Rafin', NULL, NULL),
  ('Maheer Helal', 'C. Lecturer', 'ext.maheer.helal@bracu.ac.bd'),
  ('Md Shamsur Shafi Nur E Aziz', 'C. Lecturer', 'ext.shamsur.aziz@bracu.ac.bd'),
  ('Rantu Das', 'C. Lecturer', 'ext.rantu.das@bracu.ac.bd'),
  ('ANIKA ISLAM', 'C. Lecturer', 'ext.anika.islam@bracu.ac.bd'),
  ('Sajid Imam Mahir', 'C. Lecturer', 'ext.sajid.mahir@bracu.ac.bd'),
  ('Tahsin Tanim Ramisha', 'C. Lecturer', 'ext.tahsin.ramisha@bracu.ac.bd'),
  ('Tanjim Reza', 'C. Lecturer', 'ext.tanjim.reza@bracu.ac.bd'),
  ('Md.Waseq Alauddin Alvi', 'C. Lecturer', 'ext.waseq.alvi@bracu.ac.bd'),
  ('Aunon Halder', 'C. Lecturer', 'ext.aunon.halder@bracu.ac.bd'),
  ('Nusrat Zaman Raya', 'C. Lecturer', 'ext.nusrat.raya@bracu.ac.bd'),
  ('Dr. Sadia Hamid Kazi', 'Associate Professor & Chairperson', 'skazi@bracu.ac.bd'),
  ('Dr. Mohammad Kaykobad', 'Professor', 'kaykobad@bracu.ac.bd'),
  ('Dr. Chowdhury Mofizur Rahman', 'Professor', 'rahman.mofizur@bracu.ac.bd'),
  ('Dr. Md. Khalilur Rahman', 'Professor', 'khalilur@bracu.ac.bd'),
  ('Dr. Md. Golam Rabiul Alam', 'Professor', 'rabiul.alam@bracu.ac.bd'),
  ('Dr. Md Sadek Ferdous', 'Professor', 'sadek.ferdous@bracu.ac.bd'),
  ('Dr. Amitabha Chakrabarty', 'Professor', 'amitabha@bracu.ac.bd'),
  ('Dr. Farida Chowdhury', 'Professor', 'farida.chowdhury@bracu.ac.bd'),
  ('Dr. Swakkhar Shatabda', 'Professor', 'swakkhar.shatabda@bracu.ac.bd'),
  ('Dr. Taiabul Haque', 'Professor', 'taiabul.haque@bracu.ac.bd'),
  ('Dr. Muhammad Nur Yanhaona', 'Associate Professor', 'nur.yanhaona@bracu.ac.bd'),
  ('Dr. Md. Ashraful Alam', 'Associate Professor', 'ashraful.alam@bracu.ac.bd'),
  ('Dr. Muhammad Iqbal Hossain', 'Associate Professor', 'iqbal.hossain@bracu.ac.bd'),
  ('Dr. Farig Yousuf Sadeque', 'Associate Professor', 'farig.sadeque@bracu.ac.bd'),
  ('Dr. Md. Sakir Hossain', 'Associate Professor', 'sakir.hossain@bracu.ac.bd'),
  ('Dr. Badhan Das', 'Assistant Professor', 'badhan.das@bracu.ac.bd'),
  ('Dr. Aniqua Nusrat Zereen', 'Assistant Professor', 'aniqua@bracu.ac.bd'),
  ('Mr. Annajiat Alim Rasel', 'Senior Lecturer', 'annajiat@bracu.ac.bd'),
  ('Mr. Moin Mostakim', 'Senior Lecturer', 'mostakim@bracu.ac.bd'),
  ('Md. Saiful Islam', 'Senior Lecturer', 'md.saiful.islam@bracu.ac.bd'),
  ('Md. Tawhid Anwar', 'Senior Lecturer', 'tawhid.anwar@bracu.ac.bd'),
  ('Md. Imran Bin Azad', 'Senior Lecturer', 'imran.azad@bracu.ac.bd'),
  ('Mr. Rubayat Ahmed Khan', 'Senior Lecturer', 'rubayat.ahmed@bracu.ac.bd'),
  ('Ms. Mehnaz Seraj', 'Senior Lecturer', 'seraj.mehnaz@bracu.ac.bd'),
  ('Najeefa Nikhat Choudhury', 'Senior Lecturer', 'najeefa.chy@bracu.ac.bd'),
  ('Mahrin Tasfe', 'Senior Lecturer', 'mahrin.tasfe@bracu.ac.bd'),
  ('Mr. Md. Tanzim Reza', 'Senior Lecturer', 'tanzim.reza@bracu.ac.bd'),
  ('Ms. Tasnim Ferdous', 'Senior Lecturer', 'tasnim.ferdous@bracu.ac.bd'),
  ('Dewan Ziaul Karim', 'Senior Lecturer', 'ziaul.karim@bracu.ac.bd'),
  ('Arif Shakil', 'Senior Lecturer', 'arif.shakil@bracu.ac.bd'),
  ('Mr. Syed Zamil Hasan Shoumo', 'Senior Lecturer', 'shoumo.hasan@bracu.ac.bd'),
  ('Mr. Rafeed Rahman', 'Senior Lecturer', 'rahman.rafeed@bracu.ac.bd'),
  ('Md. Saiful Bari Siddiqui', 'Senior Lecturer', 'saiful.bari@bracu.ac.bd'),
  ('Niaz Ashraf Khan', 'Senior Lecturer', 'niaz.ashraf@bracu.ac.bd'),
  ('Mr. Md. Aquib Azmain', 'Senior Lecturer', 'aquib.azmain@bracu.ac.bd'),
  ('Md. Sabbir Ahmed', 'Senior Lecturer', 'sabbir.ahmed@bracu.ac.bd'),
  ('Mr. Dibyo Fabian Dofadar', 'Senior Lecturer', 'fabian.dofadar@bracu.ac.bd'),
  ('Mr. Zaber Mohammad', 'Senior Lecturer', 'zaber.mohammad@bracu.ac.bd'),
  ('K. M. Azwad Hossain', 'Lecturer', 'azwad.hossain@bracu.ac.bd'),
  ('Md Mizanur Rahman Mustakim', 'Lecturer', 'mizanur.mustakim@bracu.ac.bd'),
  ('Md Arif Hasan', 'Lecturer', 'arif.hasan@bracu.ac.bd'),
  ('Ashraful Islam Shanto Sikder', 'Lecturer', 'ashraful.islam@bracu.ac.bd'),
  ('Mohammad Naveed Hossain', NULL, NULL),
  ('Farzana Reefat Raha', 'Lecturer', 'reefat.raha@bracu.ac.bd'),
  ('Rakib Kibria', 'Lecturer', 'rakib.kibria@bracu.ac.bd'),
  ('Nazmus Sakib Ahmed', 'Lecturer', 'nazmus.sakib@bracu.ac.bd'),
  ('Wahida Mahjabin', 'Lecturer', 'wahida.mahjabin@bracu.ac.bd'),
  ('Shoaib Ahmed Dipu', 'Lecturer', 'shoaib.ahmed@bracu.ac.bd'),
  ('Samiur Rahman', 'Lecturer', 'rahman.samiur@bracu.ac.bd'),
  ('Adrita Hossain Nakshi', 'Lecturer', 'adrita.hossain@bracu.ac.bd'),
  ('Ahmed Mahir Ruhan', 'Lecturer', 'ahmed.ruhan@bracu.ac.bd'),
  ('Bijoy Ahmed Saiem', 'Lecturer', 'bijoy.saiem@bracu.ac.bd'),
  ('Afroza Akther', 'Lecturer', 'afroza.akther@bracu.ac.bd'),
  ('Md Nafiu Rahman', 'Lecturer', 'nafiu.rahman@bracu.ac.bd'),
  ('Mr. Ankan Ghosh Dastider', 'Lecturer', 'ankan.ghosh@bracu.ac.bd'),
  ('Nazmus Sakib Touhid', 'Lecturer', 'nazmus.touhid@bracu.ac.bd'),
  ('Aroni Ghosh', 'Lecturer', 'aroni.ghosh@bracu.ac.bd'),
  ('Ittehad Saleh Chowdhury', 'Lecturer', 'ittehad.chowdhury@bracu.ac.bd'),
  ('Md. Asif Haider', 'Lecturer', 'asif.haider@bracu.ac.bd'),
  ('Soumya Swagata Biswas', 'Lecturer', 'soumya.swagata@bracu.ac.bd'),
  ('Md. Ahasanul Alam', 'Lecturer', 'ahasanul.alam@bracu.ac.bd'),
  ('Md Abu Ibrahim ( Iqra )', 'Lecturer', 'abu.ibrahim@bracu.ac.bd'),
  ('Mr. Abid Jahan Apon', 'Lecturer', 'abid.jahan@bracu.ac.bd'),
  ('Mr. Abdullah Al Nakib', 'Lecturer', 'abdullah.alnakib@bracu.ac.bd'),
  ('Ahashan Habib Niloy', 'Lecturer', 'ahashan.niloy@bracu.ac.bd'),
  ('Anika Priodorshinee Mrittika', 'Lecturer', 'anika.mrittika@bracu.ac.bd'),
  ('Aniqa Tabassum', 'Lecturer', 'aniqa.tabassum@bracu.ac.bd'),
  ('Ayman Rasheed', 'Lecturer', 'ayman.rasheed@bracu.ac.bd'),
  ('Atanu Roy', 'Lecturer', 'atanu.roy@bracu.ac.bd'),
  ('Mohammed Ashfaqul Haque', 'Lecturer', 'ashfaqul.haque@bracu.ac.bd'),
  ('Ateya Ahmed Subarna', 'Lecturer', 'ateya.ahmed@bracu.ac.bd'),
  ('Faria Binta Awal', 'Lecturer', 'faria.awal@bracu.ac.bd'),
  ('Avinandan Banerjee', 'Lecturer', 'avinandan@bracu.ac.bd'),
  ('Ariyan Hossain', 'Lecturer', 'ariyan.hossain@bracu.ac.bd'),
  ('Mohammad Badrul Hossain', 'Lecturer', 'badrul.hossain@bracu.ac.bd'),
  ('Ehtashamul Haque', 'Lecturer', 'ehtashamul.haque@bracu.ac.bd'),
  ('Md. Fatin Ishraq Faruqui', 'Lecturer', 'md.fatin@bracu.ac.bd'),
  ('Md. Fakhruddin Gazzali', 'Lecturer', 'fakhruddin.gazzali@bracu.ac.bd'),
  ('Mr. Farhan Feroz', 'Lecturer', 'farhan.feroz@bracu.ac.bd'),
  ('Fatiha Ishrar Chowdhury', 'Lecturer', 'fatiha.ishrar@bracu.ac.bd'),
  ('Md Faisal Ahmed', 'Lecturer', 'faisal.ahmed@bracu.ac.bd'),
  ('Fardin Zubair Nafis', 'Lecturer', 'fardin.zubair@bracu.ac.bd'),
  ('Mr. Sheikh Araf Noshin', 'Lecturer', 'araf.noshin@bracu.ac.bd'),
  ('Tanhiat Fatema Afnan', 'Lecturer', 'tanhiat.fatema@bracu.ac.bd'),
  ('Majisha Jahan Disha', 'Lecturer', 'majisha.jahan@bracu.ac.bd'),
  ('Ipshita Bonhi Upoma', 'Lecturer', 'ipshita.upoma@bracu.ac.bd'),
  ('Abdullah Nayem Wasi Emran', 'Lecturer', 'abdullah.nayem@bracu.ac.bd'),
  ('Ahmad Farhan Shahriar Chowdhury', 'Lecturer', 'farhan.shahriar@bracu.ac.bd'),
  ('Imam Mohammad Zulkarnain', 'Lecturer', 'imam.mohammad@bracu.ac.bd'),
  ('Md. Rifat Rahman', 'Lecturer', 'rifat.rahman@bracu.ac.bd'),
  ('Jawaril Munshad Abedin', 'Lecturer', 'jawaril.munshad@bracu.ac.bd'),
  ('Asif Hasan Chowdhury', 'Lecturer', 'asif.hasan@bracu.ac.bd'),
  ('Md. Zulkar Naim', 'Lecturer', 'zulkar.naim@bracu.ac.bd'),
  ('Jishnu Mahmud', 'Lecturer', 'jishnu.mahmud@bracu.ac.bd'),
  ('Md. Khaliduzzaman Khan Samrat', 'Lecturer', 'md.khaliduzzaman@bracu.ac.bd'),
  ('Ms. Khondoker Nazia Iqbal', 'Lecturer', 'nazia.iqbal@bracu.ac.bd'),
  ('Kazi Kamruzzaman Rabbi', 'Lecturer', 'kazi.kamruzzaman@bracu.ac.bd'),
  ('Labib Hasan Khan', 'Lecturer', 'labib.hasan@bracu.ac.bd'),
  ('Marshia Nujhat', 'Lecturer', 'marshia.nujhat@bracu.ac.bd'),
  ('Mohammad Fahim', 'Lecturer', 'mohammad.fahim@bracu.ac.bd'),
  ('Mehedi Hasan Emo', 'Lecturer', 'mehedi.emo@bracu.ac.bd'),
  ('Md. Jahin Alam', 'Lecturer', 'jahin.alam@bracu.ac.bd'),
  ('Anindita Labonno', 'Lecturer', 'anindita.labonno@bracu.ac.bd'),
  ('Meem Arafat Manab', 'Lecturer', 'meem.arafat@bracu.ac.bd'),
  ('Mushfique Nasir Probor', 'Lecturer', 'mushfique.nasir@bracu.ac.bd'),
  ('Mohammad Nuwaisir Rahman', 'Lecturer', 'nuwaisir.rahman@bracu.ac.bd'),
  ('Md. Moynul Asik Moni', 'Lecturer', 'moynul.moni@bracu.ac.bd'),
  ('Mir Sayeed Mohammad', 'Lecturer', 'sayeed.mohammad@bracu.ac.bd'),
  ('Mr. Md. Shamim Mia', 'Lecturer', 'shamim.mia@bracu.ac.bd'),
  ('Abu Obaida Hasme', 'Lecturer', 'abu.hasme@bracu.ac.bd'),
  ('A B M Muntasir Rahman', 'Lecturer', 'abm.muntasir@bracu.ac.bd'),
  ('Munshi Sanowar Raihan', 'Lecturer', 'munshi.sanowar@bracu.ac.bd'),
  ('Mr. Mohammad Zahidul Hasan', 'Lecturer', 'zadid.hasan@bracu.ac.bd'),
  ('Mr. A.T.M Mizanur Rahman', 'Lecturer', 'atm.mizanur@bracu.ac.bd'),
  ('NIRJHOR DATTA', 'Lecturer', 'nirjhor.datta@bracu.ac.bd'),
  ('Niloy Farhan', 'Lecturer', 'niloy.farhan@bracu.ac.bd'),
  ('Niloy Irtisam', 'Lecturer', 'niloy.irtisam@bracu.ac.bd'),
  ('Ms. Narzu Tarannum', 'Lecturer', 'narzu.tarannum@bracu.ac.bd'),
  ('Mr. Nabuat Zaman Nahim', 'Lecturer', 'nabuat.zaman@bracu.ac.bd'),
  ('Nazmul Islam', 'Lecturer', 'nazmul.islam1@bracu.ac.bd'),
  ('Partha Bhoumik', 'Lecturer', 'partha.bhoumik@bracu.ac.bd'),
  ('Mr. Purbayan Das', 'Lecturer', 'purbayan.das@bracu.ac.bd'),
  ('Prantik Paul', 'Lecturer', 'prantik.paul@bracu.ac.bd'),
  ('Atonu Roy Chowdhury', 'Lecturer', 'atonuroy.chowdhury@bracu.ac.bd'),
  ('Ms. Priata Nowshin', 'Lecturer', 'priata.nowshin@bracu.ac.bd'),
  ('Prothito Shovon Majumder', 'Lecturer', 'prothito.shovon@bracu.ac.bd'),
  ('Quazi Shafayat Hossain', 'Lecturer', 'quazi.shafayat@bracu.ac.bd'),
  ('Quazi Ashikur Rahman', 'Lecturer', 'quazi.ashikur@bracu.ac.bd'),
  ('Mr. Riad Ahmed', 'Lecturer', 'riad.ahmed@bracu.ac.bd'),
  ('Mr. Rakin Bin Rabbani', 'Lecturer', 'rakin.rabbani@bracu.ac.bd'),
  ('Redowanul Akbar', 'Lecturer', 'redowanul.akbar@bracu.ac.bd'),
  ('Imran Zahid', 'Lecturer', 'imran.zahid@bracu.ac.bd'),
  ('Mr. Ruhan Islam', 'Lecturer', 'ruhan.islam@bracu.ac.bd'),
  ('Mohammad Rakibul Hasan Mahin', 'Lecturer', 'mohammad.rakibul@bracu.ac.bd'),
  ('Rafid Ahnaf', 'Lecturer', 'rafid.ahnaf@bracu.ac.bd'),
  ('Raisa Mashtura', 'Lecturer', 'raisa.mashtura@bracu.ac.bd'),
  ('Rafiad Sadat Shahir', 'Lecturer', 'rafiad.shahir@bracu.ac.bd'),
  ('Rifa Tasfiya', 'Lecturer', 'rifa.tasfiya@bracu.ac.bd'),
  ('Sadif Ahmed', 'Lecturer', 'sadif.ahmed@bracu.ac.bd'),
  ('Saadat Rafid Ahmed', 'Lecturer', 'saadat.ahmed@bracu.ac.bd'),
  ('Farhan Faruk', 'Lecturer', 'farhan.faruk@bracu.ac.bd'),
  ('Md Sabbir Hossain', 'Lecturer', 'sabbir.hossain@bracu.ac.bd'),
  ('Shayekh Bin Islam', 'Lecturer', 'shayekh.bin.islam@bracu.ac.bd'),
  ('Md Saif Mokarrom', 'Lecturer', 'saif.mokarrom@bracu.ac.bd'),
  ('S. M. FARAH AL FAHIM', 'Lecturer', 'farah.fahim@bracu.ac.bd'),
  ('K. M. Shadman Wadith', 'Lecturer', 'shadman.wadith@bracu.ac.bd'),
  ('Mr. Shahriar Rahman Rana', 'Lecturer', 'shahriar.rahman@bracu.ac.bd'),
  ('Sahib Kowsar', 'Lecturer', 'sahib.kowsar@bracu.ac.bd'),
  ('Mr. Hamim Ibne Nasim', 'Lecturer', 'hamim.nasim@bracu.ac.bd'),
  ('Sihat Afnan', 'Lecturer', 'sihat.afnan@bracu.ac.bd'),
  ('Sukarna Sarker', 'Lecturer', 'sukarna.sarkar@bracu.ac.bd'),
  ('Swattic Ghose', 'Lecturer', 'swattic.ghose@bracu.ac.bd'),
  ('Showvik Biswas', 'Lecturer', 'showvik.biswas@bracu.ac.bd'),
  ('Sazzadul Islam', 'Lecturer', 'sazzadul.islam@bracu.ac.bd'),
  ('Tasnim Ahsan Prome', 'Lecturer', 'tasnim.ahsan@bracu.ac.bd'),
  ('Tarvir Anjum Aditto', 'Lecturer', 'tarvir.anjum@bracu.ac.bd'),
  ('Mohammad Tahsin Alam', 'Lecturer', 'tahsin.alam@bracu.ac.bd'),
  ('Mr. Tamkin Mahmud Tan', 'Lecturer', 'tamkin.mahmud@bracu.ac.bd'),
  ('Tanvir Muntakim Tonoy', 'Lecturer', 'tanvir.muntakim@bracu.ac.bd'),
  ('Md. Tawsif Shahriar Dipto', 'Lecturer', 'tawsif.shahriar@bracu.ac.bd'),
  ('Ms. Kefaya Benta Shahnoor', 'Lecturer', 'kefaya.shahnoor@bracu.ac.bd'),
  ('Towshik Anam Taj', 'Lecturer', 'towshik.taj@bracu.ac.bd'),
  ('Umme Jannat Taposhi', 'Lecturer', 'jannat.taposhi@bracu.ac.bd'),
  ('Tasneem Mazhar', 'Lecturer', 'tasneem.mazhar@bracu.ac.bd'),
  ('Utsab Saha', 'Lecturer', 'utsab.saha@bracu.ac.bd'),
  ('Warida Rashid', 'Lecturer', 'warida.rashid@bracu.ac.bd'),
  ('Yeasin Arafat Pritom', 'Lecturer', 'yeasin.pritom@bracu.ac.bd'),
  ('Yasmin Nadia', 'Lecturer', 'yasmin.nadia@bracu.ac.bd'),
  ('Ms. Zarin Tasnim Biash', 'Lecturer', 'zarin.tasnim.biash@bracu.ac.bd'),
  ('Zayed Humayun', 'Lecturer', 'zayed.humayun@bracu.ac.bd'),
  ('Ihzaz Abrar Sadik', 'Lecturer', 'ihzaz.sadik@bracu.ac.bd'),
  ('Mirza Abdullah Al Noman', 'Lecturer', 'mirza.abdullah@bracu.ac.bd'),
  ('Md. Muhtasim Mahmud', 'Lecturer', 'muhtasim.mahmud@bracu.ac.bd'),
  ('Ahmed Mayeesha Reza Agomoni', 'Lecturer', 'ahmed.mayeesha@bracu.ac.bd'),
  ('Maazin Munawar', 'Lecturer', 'maazin.munawar@bracu.ac.bd'),
  ('Naima Tahsin Nodi', 'Lecturer', 'naima.tahsin@bracu.ac.bd'),
  ('Pollock Nag', 'Lecturer', 'pollock.nag@bracu.ac.bd'),
  ('Riazul Islam Rifat', 'Lecturer', 'riazul.islam@bracu.ac.bd'),
  ('Sanjida Tasnim', 'Lecturer', 'sanjida.tasnim@bracu.ac.bd'),
  ('Nafis Faisal', 'Lecturer', 'nafis.faisal@bracu.ac.bd'),
  ('Waleed Bin Habib Khan', 'Lecturer', 'waleed.habib@bracu.ac.bd'),
  ('Anika Ahmed', 'Lecturer', 'anika.ahmed@bracu.ac.bd'),
  ('Ahmad Al Asad', 'Adjunct Lecturer', 'ext.ahmad.asad@bracu.ac.bd'),
  ('Adrita Anwar', 'Adjunct Lecturer', 'ext.adrita.anwar@bracu.ac.bd'),
  ('Ms. Aiman Jabeen Ramisa', 'Adjunct Lecturer', 'ext.aiman.ramisa@bracu.ac.bd'),
  ('Ms. Anika Tasnim', 'Adjunct Lecturer', 'ext.anika.tasnim@bracu.ac.bd'),
  ('Md. Anonto Shuvo', 'Adjunct Lecturer', 'ext.anonto.shuvo@bracu.ac.bd'),
  ('Mr. ABU RAIHAN SHAKIL', 'Adjunct Lecturer', 'ext.abu.raihan@bracu.ac.bd'),
  ('A S M Nasim Khan', 'Adjunct Lecturer', 'ext.nasim.khan@bracu.ac.bd'),
  ('Shihab Muhtasim', 'Adjunct Lecturer', 'ext.shihab.muhtasim@bracu.ac.bd'),
  ('Joya Akter', 'Adjunct Lecturer', 'ext.joya.akter@bracu.ac.bd'),
  ('Kaji Sajjad Hossain', 'Adjunct Lecturer', 'ext.sajjad.hossain@bracu.ac.bd'),
  ('Nafis Chowdhury', 'Adjunct Lecturer', 'ext.nafis.chowdhury@bracu.ac.bd'),
  ('Mohammad Abdul Ahad', 'Adjunct Lecturer', 'ext.mohammad.abdul@bracu.ac.bd'),
  ('Sadman Sharif', 'Adjunct Lecturer', 'ext.sadman.sharif@bracu.ac.bd'),
  ('Sadman Sakib Alif', 'Adjunct Lecturer', 'ext.sadman.alif@bracu.ac.bd'),
  ('MD Ajmain Mahtab', 'Adjunct Lecturer', 'ext.ajmain.mahtab@bracu.ac.bd'),
  ('Mostofa Kamal Sagor', 'Adjunct Lecturer', 'ext.mostofa.kamal@bracu.ac.bd'),
  ('Mr. Md. Mahedi Hassan', 'Adjunct Lecturer', 'ext.mahedi.hassan@bracu.ac.bd'),
  ('Mr. Mehran Hossain', 'Adjunct Lecturer', 'ext.mehran.hossain@bracu.ac.bd'),
  ('Ayon Roy', 'Adjunct Lecturer', 'ext.ayon.roy@bracu.ac.bd'),
  ('Mohammad Sayeem Sadat Hossain', 'Adjunct Lecturer', 'ext.mohammad.sayeem@bracu.ac.bd'),
  ('Md. Mustakin Alam', 'Adjunct Lecturer', 'ext.md.mustakin@bracu.ac.bd'),
  ('Fardeen Bin Ibrahim', 'Adjunct Lecturer', 'ext.fardeen.ibrahim@bracu.ac.bd'),
  ('Ms. Nishat Nayla', 'Adjunct Lecturer', 'ext.nishat.nayla@bracu.ac.bd'),
  ('Nowshin Tabassum', 'Adjunct Lecturer', 'ext.nowshin.tabassum@bracu.ac.bd'),
  ('Qurratul Ayen Elma', 'Adjunct Lecturer', 'ext.qurratul.elma@bracu.ac.bd'),
  ('Md. Rabiul Islam Khan', 'Adjunct Lecturer', 'ext.rabiul.khan@bracu.ac.bd'),
  ('Farah Binta Haque', 'Adjunct Lecturer', 'ext.farah.haque@bracu.ac.bd'),
  ('Ramisa Fariha Joyee', 'Adjunct Lecturer', 'ext.ramisa.joyee@bracu.ac.bd'),
  ('Ms. Sameha Kamrul', 'Adjunct Lecturer', 'ext.sameha.kamrul@bracu.ac.bd'),
  ('Masuk Ridwan Saumo', 'Adjunct Lecturer', 'ext.masuk.saumo@bracu.ac.bd'),
  ('Sriman Bidhan Baray', 'Adjunct Lecturer', 'ext.bidhan.baray@bracu.ac.bd'),
  ('Mr. Sifat Tanvir', 'Adjunct Lecturer', 'ext.sifat.tanvir@bracu.ac.bd'),
  ('Tasnia Juha', 'Adjunct Lecturer', 'ext.tasnia.juha@bracu.ac.bd'),
  ('Ms. Zarin Tahia Hossain', 'Adjunct Lecturer', 'ext.zarin.tahia@bracu.ac.bd'),
  ('MD. Atiq Mahbub', 'Research Assistant', 'atiq.mahbub@bracu.ac.bd'),
  ('Md. Alvi Islam Ratul', 'Research Assistant', 'alvi.islam@bracu.ac.bd'),
  ('Md. Farhadul Islam', 'Research Assistant', 'farhadul.islam@bracu.ac.bd'),
  ('Fahim-Ul-Islam', 'Research Assistant', 'fahim.islam@bracu.ac.bd'),
  ('Md Ishmam Tasin', 'Research Assistant', 'ishmam.tasin@bracu.ac.bd'),
  ('Pratyasha Saha', 'Research Assistant', 'pratyasha.saha@bracu.ac.bd');

DO $validate_import$
BEGIN
  IF (SELECT count(*) FROM pg_temp.cse_supervisor_import) <> 252 OR EXISTS (
    SELECT 1 FROM pg_temp.cse_supervisor_import
    GROUP BY lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'unexpected supervisor source count or duplicate';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.faculty f
    WHERE f.department = 'CSE'
    GROUP BY lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ambiguous existing CSE faculty name; reconcile before importing';
  END IF;
END;
$validate_import$;

-- Snapshot all faculty, including unrelated records. Only actual enrichment
-- may advance updated_at via the existing timestamp trigger.
CREATE TEMP TABLE cse_faculty_before ON COMMIT DROP AS
SELECT f.id, to_jsonb(f) AS original,
       CASE WHEN nullif(btrim(f.designation), '') IS NULL THEN coalesce(s.designation, f.designation) ELSE f.designation END AS designation,
       CASE WHEN nullif(btrim(f.email), '') IS NULL THEN coalesce(s.email, f.email) ELSE f.email END AS email
FROM public.faculty f
LEFT JOIN pg_temp.cse_supervisor_import s ON f.department = 'CSE'
 AND lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
   = lower(btrim(regexp_replace(s.name, '[[:space:]]+', ' ', 'g')));

UPDATE public.faculty f
SET designation = CASE WHEN nullif(btrim(f.designation), '') IS NULL THEN coalesce(s.designation, f.designation) ELSE f.designation END,
    email = CASE WHEN nullif(btrim(f.email), '') IS NULL THEN coalesce(s.email, f.email) ELSE f.email END
FROM pg_temp.cse_supervisor_import s
WHERE f.department = 'CSE'
  AND lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
    = lower(btrim(regexp_replace(s.name, '[[:space:]]+', ' ', 'g')))
  AND ((nullif(btrim(f.designation), '') IS NULL AND s.designation IS NOT NULL)
    OR (nullif(btrim(f.email), '') IS NULL AND s.email IS NOT NULL));

INSERT INTO public.faculty(slug, name, department, designation, email)
SELECT coalesce(nullif(rtrim(left(trim(both '-' FROM regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')), 50), '-'), ''), 'faculty')
         || '-' || gen_random_uuid()::text,
       s.name, 'CSE', s.designation, s.email
FROM pg_temp.cse_supervisor_import s
WHERE NOT EXISTS (
  SELECT 1 FROM public.faculty f WHERE f.department = 'CSE'
    AND lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
      = lower(btrim(regexp_replace(s.name, '[[:space:]]+', ' ', 'g')))
);

DO $verify_import$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.cse_supervisor_import s
    LEFT JOIN public.faculty f ON f.department = 'CSE'
     AND lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
       = lower(btrim(regexp_replace(s.name, '[[:space:]]+', ' ', 'g')))
    GROUP BY s.name HAVING count(f.id) <> 1
  ) OR EXISTS (
    SELECT 1 FROM public.faculty f WHERE f.department = 'CSE'
    GROUP BY lower(btrim(regexp_replace(f.name, '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'import identity verification failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_temp.cse_faculty_before b
    LEFT JOIN public.faculty f ON f.id = b.id
    WHERE f.id IS NULL OR f.designation IS DISTINCT FROM b.designation
       OR f.email IS DISTINCT FROM b.email
       OR (to_jsonb(f) - ARRAY['designation','email','updated_at'])
           IS DISTINCT FROM (b.original - ARRAY['designation','email','updated_at'])
       OR (to_jsonb(f)->'updated_at' IS DISTINCT FROM b.original->'updated_at'
           AND (b.designation, b.email) IS NOT DISTINCT FROM
               (b.original->>'designation', b.original->>'email'))
  ) THEN
    RAISE EXCEPTION 'existing faculty preservation verification failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.faculty f
    LEFT JOIN pg_temp.cse_supervisor_import s ON f.department = 'CSE' AND f.name = s.name
    WHERE NOT EXISTS (SELECT 1 FROM pg_temp.cse_faculty_before b WHERE b.id = f.id)
      AND (s.name IS NULL OR f.designation IS DISTINCT FROM s.designation
        OR f.email IS DISTINCT FROM s.email OR f.summary_note IS NOT NULL
        OR f.is_active IS DISTINCT FROM true
        OR EXISTS (SELECT 1 FROM public.faculty_reviews r WHERE r.faculty_id = f.id))
  ) THEN
    RAISE EXCEPTION 'new faculty verification failed';
  END IF;

  IF (SELECT array_agg(attname::text ORDER BY attnum)
      FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.faculty_public'::regclass AND attnum > 0 AND NOT attisdropped)
     IS DISTINCT FROM ARRAY['id','slug','name','initials','department','summary_note','created_at']
     OR EXISTS (
       SELECT id, slug, name, initials, department, summary_note, created_at
       FROM public.faculty WHERE is_active
       EXCEPT ALL SELECT * FROM public.faculty_public
     ) OR EXISTS (
       SELECT * FROM public.faculty_public
       EXCEPT ALL
       SELECT id, slug, name, initials, department, summary_note, created_at
       FROM public.faculty WHERE is_active
     )
  THEN
    RAISE EXCEPTION 'public faculty visibility or privacy verification failed';
  END IF;
END;
$verify_import$;

COMMIT;
