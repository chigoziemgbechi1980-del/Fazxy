import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

type SubmissionForm = {
  fullName: string;
  title: string;
  profilePhoto: string;
  dateOfBirth: string;
  placeOfBirth: string;
  currentLocation: string;
  profession: string;
  shortIntro: string;
  childhood: string;
  familyBackground: string;
  education: string;
  careerJourney: string;
  achievements: string;
  businessVentures: string;
  hobbies: string;
  majorExperiences: string;
  challenges: string;
  contributions: string;
  futureAmbitions: string;
  messageToWorld: string;
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
  relationship: string;
  category: string;
};

const defaultForm: SubmissionForm = {
  fullName: '',
  title: '',
  profilePhoto: '',
  dateOfBirth: '',
  placeOfBirth: '',
  currentLocation: '',
  profession: '',
  shortIntro: '',
  childhood: '',
  familyBackground: '',
  education: '',
  careerJourney: '',
  achievements: '',
  businessVentures: '',
  hobbies: '',
  majorExperiences: '',
  challenges: '',
  contributions: '',
  futureAmbitions: '',
  messageToWorld: '',
  submitterName: '',
  submitterEmail: '',
  submitterPhone: '',
  relationship: '',
  category: 'Leadership'
};

const initialAdminLogin = {
  email: 'chigoziemgbechi1980@gmail.com',
  password: 'Favour1478'
};

export default function App() {
  const [route, setRoute] = useState<string>(window.location.pathname);
  const [siteSettings, setSiteSettings] = useState<Record<string, any>>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [biographies, setBiographies] = useState<any[]>([]);
  const [selectedBiography, setSelectedBiography] = useState<any | null>(null);
  const [submission, setSubmission] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [form, setForm] = useState<SubmissionForm>(defaultForm);
  const [step, setStep] = useState(0);
  const [admin, setAdmin] = useState<any | null>(null);
  const [adminLogin, setAdminLogin] = useState(initialAdminLogin);
  const [adminData, setAdminData] = useState<any[]>([]);
  const [paymentReference, setPaymentReference] = useState('');
  const [resultsMessage, setResultsMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  const fetchPublicData = async () => {
    try {
      const [settingsRes, categoriesRes, biographiesRes] = await Promise.all([
        fetch(`${API_BASE}/site-settings`, { credentials: 'include' }),
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/public/biographies`)
      ]);

      const settingsData = await settingsRes.json();
      const categoryData = await categoriesRes.json();
      const biographyData = await biographiesRes.json();

      setSiteSettings(settingsData.settings || {});
      setCategories(categoryData.categories || []);
      setBiographies(biographyData.biographies || []);
    } catch (err) {
      setSiteSettings({});
      setCategories([]);
      setBiographies([]);
    }
  };

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    fetchPublicData();
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!route.startsWith('/biography/')) return;
    const slug = route.replace('/biography/', '').trim();
    fetch(`${API_BASE}/public/biographies/${slug}`)
      .then((res) => res.json())
      .then((data) => setSelectedBiography(data.biography || null))
      .catch(() => setSelectedBiography(null));
  }, [route]);

  useEffect(() => {
    if (route !== '/admin') return;
    fetch(`${API_BASE}/admin/session`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then((data) => {
        setAdmin(data.admin);
        fetchAdminData();
      })
      .catch(() => {
        setAdmin(null);
        navigate('/admin/login');
      });
  }, [route]);

  const fetchAdminData = async () => {
    const response = await fetch(`${API_BASE}/admin/submissions`, { credentials: 'include' });
    if (!response.ok) {
      setAdminData([]);
      return;
    }

    const data = await response.json();
    setAdminData(data.submissions || []);
  };

  const updateField = (key: keyof SubmissionForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const steps = ['Personal Details', 'Life Story', 'Media', 'Contact & Review'];

  const submitForm = async () => {
    setErrorMessage('');
    setResultsMessage('');

    const requiredFields = [
      'fullName', 'title', 'profession', 'shortIntro', 'childhood',
      'education', 'careerJourney', 'achievements', 'submitterName', 'submitterEmail'
    ] as const;

    const missing = requiredFields.filter((key) => !String(form[key]).trim());
    if (missing.length) {
      setErrorMessage('Please complete all required fields before submitting.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error || 'Submission failed.');
        return;
      }

      setSubmission(data.submission);

      if (galleryFiles.length > 0) {
        const mediaForm = new FormData();
        galleryFiles.forEach((file) => mediaForm.append('photos', file));
        await fetch(`${API_BASE}/submissions/${data.submission.id}/media`, {
          method: 'POST',
          body: mediaForm
        });
      }

      setResultsMessage(`Submission created successfully. Your reference number is ${data.submission.reference}.`);
      setForm(defaultForm);
      setGalleryFiles([]);
      setStep(0);
      navigate('/submission-success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Submission could not be completed.');
    }
  };

  const handlePaymentSubmit = async () => {
    if (!submission || !paymentReference.trim()) {
      setErrorMessage('Please enter a transfer reference before continuing.');
      return;
    }

    const response = await fetch(`${API_BASE}/submissions/${submission.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferReference: paymentReference })
    });

    const data = await response.json();
    if (!response.ok) {
      setErrorMessage(data.error || 'Payment update failed.');
      return;
    }

    setResultsMessage('Payment claim submitted. It is now pending verification.');
    setPaymentReference('');
  };

  const handleAdminLogin = async (event: any) => {
    event.preventDefault();
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminLogin)
    });

    const data = await response.json();
    if (!response.ok) {
      setErrorMessage(data.error || 'Login failed');
      return;
    }

    setAdmin(data.admin);
    navigate('/admin');
  };

  const handleAdminLogout = async () => {
    await fetch(`${API_BASE}/admin/logout`, { method: 'POST', credentials: 'include' });
    setAdmin(null);
    navigate('/admin/login');
  };

  const markVerified = async (id: string) => {
    await fetch(`${API_BASE}/admin/submissions/${id}/verify-payment`, {
      method: 'POST',
      credentials: 'include'
    });
    fetchAdminData();
  };

  const markPublished = async (id: string) => {
    await fetch(`${API_BASE}/admin/submissions/${id}/publish`, {
      method: 'POST',
      credentials: 'include'
    });
    fetchAdminData();
  };

  const currentSettings = useMemo(() => ({
    site_name: siteSettings.site_name || 'My Life Story',
    fee: Number(siteSettings.fee || 3000),
    bank_name: siteSettings.bank_name || 'Bank transfer details will be available soon',
    account_name: siteSettings.account_name || 'Bank transfer details will be available soon',
    account_number: siteSettings.account_number || 'Bank transfer details will be available soon',
    contact_email: siteSettings.contact_email || 'hello@mylifestory.example',
    contact_phone: siteSettings.contact_phone || '+234 800 000 0000',
    homepage_intro: siteSettings.homepage_intro || 'Every life has a story worth telling.'
  }), [siteSettings]);

  const filteredBiographies = useMemo(() => {
    return biographies.filter((bio) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [bio.title, bio.full_name, bio.profession].some((value) =>
        String(value || '').toLowerCase().includes(query)
      );
      const matchesCategory = !selectedCategory || bio.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [biographies, search, selectedCategory]);

  const renderHeader = () => (
    <header className="main-header">
      <div className="nav container">
        <div className="brand" onClick={() => navigate('/')}>{currentSettings.site_name}</div>
        <nav>
          <button onClick={() => navigate('/')}>Home</button>
          <button onClick={() => navigate('/explore')}>Explore</button>
          <button onClick={() => navigate('/publish')}>Publish</button>
          <button onClick={() => navigate('/admin/login')}>Admin</button>
        </nav>
      </div>
    </header>
  );

  if (route.startsWith('/biography/')) {
    return (
      <div className="page-shell">
        {renderHeader()}
        <main className="container biography-detail">
          {selectedBiography ? (
            <>
              <div className="biography-header">
                <div>
                  <span className="eyebrow">{selectedBiography.category || 'Biography'}</span>
                  <h1>{selectedBiography.title}</h1>
                  <h3>{selectedBiography.full_name}</h3>
                  <p>{selectedBiography.profession}</p>
                </div>
                <img
                  src={selectedBiography.profile_photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80'}
                  alt={selectedBiography.full_name}
                />
              </div>

              <div className="bio-grid">
                <div className="bio-story">
                  <section>
                    <h4>Short Introduction</h4>
                    <p>{selectedBiography.short_intro}</p>
                  </section>
                  <section>
                    <h4>Childhood & Upbringing</h4>
                    <p>{selectedBiography.childhood}</p>
                  </section>
                  <section>
                    <h4>Education</h4>
                    <p>{selectedBiography.education}</p>
                  </section>
                  <section>
                    <h4>Career Journey</h4>
                    <p>{selectedBiography.career_journey}</p>
                  </section>
                  <section>
                    <h4>Achievements</h4>
                    <p>{selectedBiography.achievements}</p>
                  </section>
                  <section>
                    <h4>Message to the World</h4>
                    <p>{selectedBiography.message_to_world}</p>
                  </section>
                </div>

                <aside className="meta-panel">
                  <h4>Profile</h4>
                  <ul>
                    <li><strong>Published:</strong> {selectedBiography.published_at ? new Date(selectedBiography.published_at).toLocaleDateString() : 'Pending'}</li>
                    <li><strong>Location:</strong> {selectedBiography.current_location || 'Not provided'}</li>
                    <li><strong>Profession:</strong> {selectedBiography.profession}</li>
                  </ul>
                  <div className="share-buttons">
                    <button className="secondary-btn" type="button">Share</button>
                    <button className="secondary-btn" type="button">Copy Link</button>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className="empty-state">Biography not found.</div>
          )}
        </main>
      </div>
    );
  }

  if (route === '/admin/login') {
    return (
      <div className="page-shell auth-shell">
        <div className="auth-box">
          <h2>Admin Login</h2>
          <form onSubmit={handleAdminLogin}>
            <label>Email</label>
            <input
              type="email"
              value={adminLogin.email}
              onChange={(e) => setAdminLogin((prev) => ({ ...prev, email: e.target.value }))}
            />
            <label>Password</label>
            <input
              type="password"
              value={adminLogin.password}
              onChange={(e) => setAdminLogin((prev) => ({ ...prev, password: e.target.value }))}
            />
            <button type="submit" className="primary-btn">Login</button>
          </form>
          {errorMessage && <p className="error">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  if (route === '/admin') {
    return (
      <div className="page-shell">
        <header className="main-header admin-header">
          <div className="nav container">
            <div className="brand">My Life Story Admin</div>
            <nav>
              <button onClick={fetchAdminData} className="secondary-btn">Refresh</button>
              <button onClick={handleAdminLogout} className="secondary-btn">Logout</button>
            </nav>
          </div>
        </header>

        <main className="container admin-panel">
          <h2>Overview</h2>
          <div className="stats-grid">
            <div className="stat-card"><span>Total submissions</span><strong>{adminData.length}</strong></div>
            <div className="stat-card"><span>Pending payments</span><strong>{adminData.filter((item) => item.payment_status === 'pending_verification').length}</strong></div>
            <div className="stat-card"><span>Verified payments</span><strong>{adminData.filter((item) => item.payment_status === 'verified').length}</strong></div>
            <div className="stat-card"><span>Published biographies</span><strong>{adminData.filter((item) => item.publication_status === 'published').length}</strong></div>
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Payment</th>
                  <th>Publication</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.reference}</td>
                    <td>{item.full_name}</td>
                    <td>{item.title}</td>
                    <td>{item.payment_status}</td>
                    <td>{item.publication_status}</td>
                    <td>
                      <button onClick={() => markVerified(item.id)} className="secondary-btn">Verify</button>
                      <button onClick={() => markPublished(item.id)} className="primary-btn">Publish</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  if (route === '/submission-success') {
    return (
      <div className="page-shell">
        {renderHeader()}
        <main className="container centered-panel">
          <div className="success-card">
            <h2>Submission received</h2>
            <p>{resultsMessage || 'Your biography is saved and awaiting payment verification and editorial review.'}</p>
            <div className="payment-box">
              <h3>Publishing Fee: ₦{currentSettings.fee}</h3>
              <p>Bank name: {currentSettings.bank_name}</p>
              <p>Account name: {currentSettings.account_name}</p>
              <p>Account number: {currentSettings.account_number}</p>
              <label>Transfer Reference</label>
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter transfer reference"
              />
              <button onClick={handlePaymentSubmit} className="primary-btn">I Have Made Payment</button>
            </div>
            {errorMessage && <p className="error">{errorMessage}</p>}
          </div>
        </main>
      </div>
    );
  }

  if (route === '/explore') {
    return (
      <div className="page-shell">
        {renderHeader()}
        <main className="container form-page">
          <div className="search-block">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search biographies by name, title, or profession"
            />
          </div>

          <div className="category-filter-row">
            <button className={selectedCategory === '' ? 'active-filter' : ''} onClick={() => setSelectedCategory('')}>All</button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={selectedCategory === cat.name ? 'active-filter' : ''}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="card-grid explore-grid">
            {filteredBiographies.map((bio) => (
              <article key={bio.id} className="bio-card" onClick={() => navigate(`/biography/${bio.public_slug}`)}>
                <img
                  src={bio.profile_photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80'}
                  alt={bio.title}
                />
                <div>
                  <span className="tag">{bio.category || 'Biography'}</span>
                  <h3>{bio.title}</h3>
                  <p>{bio.full_name}</p>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (route === '/publish') {
    return (
      <div className="page-shell">
        {renderHeader()}
        <main className="container form-page">
          <h1>Publish Your Biography</h1>
          <div className="stepper">
            {steps.map((text, idx) => (
              <div key={idx} className={`step ${idx === step ? 'active' : ''}`}>
                <span>{idx + 1}</span>
                {text}
              </div>
            ))}
          </div>

          {errorMessage && <div className="error">{errorMessage}</div>}

          {step === 0 && (
            <div className="form-grid">
              <label>Full name<input value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} /></label>
              <label>Biography title<input value={form.title} onChange={(e) => updateField('title', e.target.value)} /></label>
              <label>Profession<input value={form.profession} onChange={(e) => updateField('profession', e.target.value)} /></label>
              <label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} /></label>
              <label>Place of birth<input value={form.placeOfBirth} onChange={(e) => updateField('placeOfBirth', e.target.value)} /></label>
              <label>Current location<input value={form.currentLocation} onChange={(e) => updateField('currentLocation', e.target.value)} /></label>
              <label className="full-width">Short personal introduction<textarea value={form.shortIntro} onChange={(e) => updateField('shortIntro', e.target.value)} /></label>
            </div>
          )}

          {step === 1 && (
            <div className="form-grid">
              <label className="full-width">Childhood and upbringing<textarea value={form.childhood} onChange={(e) => updateField('childhood', e.target.value)} /></label>
              <label className="full-width">Family background<textarea value={form.familyBackground} onChange={(e) => updateField('familyBackground', e.target.value)} /></label>
              <label className="full-width">Education<textarea value={form.education} onChange={(e) => updateField('education', e.target.value)} /></label>
              <label className="full-width">Career journey<textarea value={form.careerJourney} onChange={(e) => updateField('careerJourney', e.target.value)} /></label>
              <label className="full-width">Achievements and awards<textarea value={form.achievements} onChange={(e) => updateField('achievements', e.target.value)} /></label>
              <label className="full-width">Business ventures<textarea value={form.businessVentures} onChange={(e) => updateField('businessVentures', e.target.value)} /></label>
              <label className="full-width">Hobbies and interests<textarea value={form.hobbies} onChange={(e) => updateField('hobbies', e.target.value)} /></label>
              <label className="full-width">Major life experiences<textarea value={form.majorExperiences} onChange={(e) => updateField('majorExperiences', e.target.value)} /></label>
              <label className="full-width">Challenges overcome<textarea value={form.challenges} onChange={(e) => updateField('challenges', e.target.value)} /></label>
              <label className="full-width">Contributions to society<textarea value={form.contributions} onChange={(e) => updateField('contributions', e.target.value)} /></label>
              <label className="full-width">Future ambitions<textarea value={form.futureAmbitions} onChange={(e) => updateField('futureAmbitions', e.target.value)} /></label>
              <label className="full-width">Message to the world<textarea value={form.messageToWorld} onChange={(e) => updateField('messageToWorld', e.target.value)} /></label>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <label className="full-width">Upload photographs<input type="file" multiple accept="image/*" onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} /></label>
              <div className="uploads-preview">
                {galleryFiles.map((file, idx) => <span key={idx}>{file.name}</span>)}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-grid">
              <label>Submitter name<input value={form.submitterName} onChange={(e) => updateField('submitterName', e.target.value)} /></label>
              <label>Email<input type="email" value={form.submitterEmail} onChange={(e) => updateField('submitterEmail', e.target.value)} /></label>
              <label>Phone number<input value={form.submitterPhone} onChange={(e) => updateField('submitterPhone', e.target.value)} /></label>
              <label>Relationship to subject<input value={form.relationship} onChange={(e) => updateField('relationship', e.target.value)} /></label>
              <label>Category<select value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select></label>
              <div className="full-width review-box">
                <h3>Review</h3>
                <p><strong>Biography title:</strong> {form.title}</p>
                <p><strong>Full name:</strong> {form.fullName}</p>
                <p><strong>Profession:</strong> {form.profession}</p>
                <p><strong>Publishing fee:</strong> ₦{currentSettings.fee}</p>
                <p><strong>Confirm:</strong> I have permission to submit this biography and the photographs.</p>
              </div>
            </div>
          )}

          <div className="form-actions">
            {step > 0 && <button onClick={() => setStep((prev) => prev - 1)} className="secondary-btn">Back</button>}
            {step < steps.length - 1 && <button onClick={() => setStep((prev) => prev + 1)} className="primary-btn">Next</button>}
            {step === steps.length - 1 && <button onClick={submitForm} className="primary-btn">Submit Biography</button>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {renderHeader()}

      <main>
        <section className="hero container">
          <div>
            <span className="eyebrow">Professional Biography Publishing</span>
            <h1>Every Life Has a Story Worth Telling.</h1>
            <p>{currentSettings.homepage_intro}</p>
            <div className="cta-row">
              <button className="primary-btn" onClick={() => navigate('/publish')}>Publish Your Biography</button>
              <button className="secondary-btn" onClick={() => navigate('/explore')}>Explore Biographies</button>
            </div>
          </div>

          <div className="hero-visual">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"
              alt="Biographer portrait"
            />
          </div>
        </section>

        <section className="search container">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search biographies by name, title, or profession"
          />
        </section>

        <section className="categories container">
          <div className="section-head">
            <h2>Biography Categories</h2>
          </div>
          <div className="category-grid">
            {categories.map((cat) => (
              <button key={cat.id} className="category-card" onClick={() => setSelectedCategory(cat.name)}>
                <strong>{cat.name}</strong>
                <span>{cat.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="featured container">
          <div className="section-head">
            <h2>Featured Biographies</h2>
          </div>
          <div className="card-grid">
            {filteredBiographies.slice(0, 3).map((bio) => (
              <article key={bio.id} className="bio-card" onClick={() => navigate(`/biography/${bio.public_slug}`)}>
                <img
                  src={bio.profile_photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80'}
                  alt={bio.title}
                />
                <div>
                  <span className="tag">{bio.category || 'Biography'}</span>
                  <h3>{bio.title}</h3>
                  <p>{bio.full_name}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="publishing-process container">
          <div className="section-head">
            <h2>How Publishing Works</h2>
          </div>
          <div className="steps-grid">
            <div className="step-box"><strong>1.</strong><span>Submit your biography and media.</span></div>
            <div className="step-box"><strong>2.</strong><span>Make the ₦{currentSettings.fee} bank transfer.</span></div>
            <div className="step-box"><strong>3.</strong><span>Admin verifies payment and reviews your story.</span></div>
            <div className="step-box"><strong>4.</strong><span>Approved stories become public.</span></div>
          </div>
        </section>

        <section className="fee-banner container">
          <div>
            <h3>Publishing Fee</h3>
            <p>One-time fee: ₦{currentSettings.fee}</p>
          </div>
          <div>
            <h3>Bank Transfer</h3>
            <p>{currentSettings.bank_name}</p>
            <p>{currentSettings.account_name}</p>
            <p>{currentSettings.account_number}</p>
          </div>
        </section>

        <section className="recent container">
          <div className="section-head">
            <h2>Recently Published</h2>
          </div>
          <div className="card-grid">
            {filteredBiographies.slice(0, 4).map((bio) => (
              <article key={bio.id} className="bio-card small" onClick={() => navigate(`/biography/${bio.public_slug}`)}>
                <img
                  src={bio.profile_photo || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80'}
                  alt={bio.title}
                />
                <div>
                  <h3>{bio.title}</h3>
                  <p>{bio.full_name}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <h4>{currentSettings.site_name}</h4>
            <p>{currentSettings.homepage_intro}</p>
          </div>
          <div>
            <h4>Contact</h4>
            <p>{currentSettings.contact_email}</p>
            <p>{currentSettings.contact_phone}</p>
          </div>
          <div>
            <h4>Links</h4>
            <p>Privacy Policy</p>
            <p>Terms of Service</p>
            <p>Publish</p>
          </div>
        </div>
      </footer>
    </div>
  );
}














