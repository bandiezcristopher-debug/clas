/* ============================================================
   CAAP FORM COORDINATE MAP
   All coordinates are [x, top] in PDF points, measured from the
   TOP-LEFT corner of the page (the same way you'd measure in a
   PDF viewer). The renderer converts them to pdf-lib's
   bottom-left origin automatically.

   To nudge a field: change the numbers here only.
   +x moves right, +top moves DOWN.
   ============================================================ */

const COORDS = {

  /* ---------- 1. AIRMEN LICENSE FLOW, PERMIT & CLEARANCE FORM ---------- */
  flow: {
    file: 'templates/flow.pdf',
    page: 0,
    size: [612, 936],
    fontSize: 9.4,

    // areas of the template that must be painted over (stray sample data)
    whiteout: [
      [410.5, 197, 46, 13], // stray D.O.B. value
      [163, 304, 8, 13],     // stray "-" after Ht (cm)
      [233, 304, 8, 13],     // stray "-" after Wt (kg)
      [294, 350, 8, 13],     // stray "-" after License No
    ],
    // the two officer signatures baked into the template (row 1)
    officerSigs: [
      [311, 527, 31, 31],
      [415, 527, 38, 28],
    ],

    /* Staff "Approve" (row 1 of the process table): the date is printed centred in the
       Date In and Date Permit Issue cells and the two officer signatures are left on the form.
       cols = [left, right] of each cell, top = where the text starts, size = font size. */
    approve: {
      dateIn:     { cols: [143.8, 228.1], top: 536, size: 11.5 },
      datePermit: { cols: [228.1, 310],   top: 536, size: 11.5 },
    },

    /* TOCID validation stamp: drawn in the free area right of the XIII Remarks / English proficiency lines
       (x, top, width, height). */
    tocid: { box: [443, 399, 112, 98] },

    checks: {                      // "License Applied for" boxes
      original:       [61.7, 165.2],
      additional:     [179.5, 165.2],
      reinstatement:  [247.2, 165.2],
    },

    photo: [494.3, 98.7, 62, 63.4],          // x, top, w, h
    // signature entry cell is x:307.1-475.3, y:842.8-868.1 — sized to nearly
    // fill it; clientName sits just under the divider, above the printed
    // "Signature over printed name of client" caption.
    clientSig: [309, 843.5, 164, 23],
    clientName: [309, 869, 164],

    fields: {
      lastName:    [103, 199.7],
      firstName:   [182.6, 199.7],
      middleName:  [257.2, 199.7],
      dob:         [411, 199.7, 45],
      pob:         [421, 208.9],
      address:     [111, 232.4, 244],
      addr:        { min: 7.4, two: { size: 6.3, top: 229.2, lh: 6.4 } },   // v7.4: lifted off the line; 2 lines when long
      city:        [82, 242.7, 100],
      province:    [193, 242.7, 60],
      nationality: [426, 233.5, 120],
      country:     [401, 242.7, 145],
      postal:      [118, 265.9],
      mobile:      [184, 265.9],
      phone:       [241, 265.9],
      company:     [146, 285.6, 80],
      email:       [196, 285.6, 175],
      sex:         [100, 306],
      height:      [164, 306],
      weight:      [234, 306],
      hair:        [289, 306],
      eyes:        [346, 306],
      licenseType: [136, 352.5, 85],
      licenseNo:   [295, 351.8],
      dateIssuance:[491, 351.8],
      ratings:     [62, 384, 480],     // wraps
      remarks:     [62, 411, 320],
      epr:         [180, 435.5, 265],
      limitations: [123, 461.5, 268],
      otherLic:    [131, 486.9, 400],
    },

    // 8 process rows: [Date In, 2nd col, Endorsing, Approving, Remarks]

    // Rows where a label follows a value on the same line. The renderer paints
    // over `clear`, then re-lays the sequence so labels slide right exactly the
    // way they do in the original document. `tab` is a minimum x (a tab stop).
    flowRows: [
      { clear: [122, 242.5, 232, 9.8], top: 242.7, vs: 8.6, right: 352, minVs: 5.6, items: [
        { f: 'city', tab: 82 }, { l: 'State/Province :', tab: 124.7 }, { f: 'province' } ] },
      { clear: [130, 264, 190, 13], top: 265.9, items: [
        { f: 'postal', tab: 118 }, { l: 'Mobile No.:', tab: 133.6 }, { f: 'mobile' },
        { l: 'Phone No.:', tab: 191.5 }, { f: 'phone' } ] },
      { clear: [163, 284, 210, 13], top: 285.6, items: [
        { f: 'company', tab: 146 }, { l: 'Email:', tab: 167 }, { f: 'email' } ] },
      { clear: [124, 304, 245, 13], top: 306, items: [
        { f: 'sex', tab: 99.9 }, { l: 'Ht (cm):', tab: 126 }, { f: 'height' },
        { l: 'Wt (kg):', tab: 196.4 }, { f: 'weight' },
        { l: 'Hair:', tab: 266.2 }, { f: 'hair' },
        { l: 'Eyes:', tab: 319.9 }, { f: 'eyes' } ] },
    ],

    rowTops: [523.2, 580.2, 624.5, 665.4, 714.6, 765.5, 807.6, 842.8],
    rowCols: [143.8, 228.1, 310, 396, 486],
    rowOffset: 6,
  },

  /* ---------- 2. PEL FORM 541 — FLIGHT CREW ---------- */
  f541: {
    file: 'templates/form541.pdf',
    page: 0,
    size: [609.6, 935.52],
    fontSize: 8.5,

    checks: {
      // A. application is made for
      act_issuance:    [170.4, 149.8],
      act_reissuance:  [220.6, 149.8],
      act_additional:  [273.8, 149.8],
      // A. license applied for
      lic_student:     [40.0, 166.0],
      lic_private:     [40.0, 174.3],
      lic_commercial:  [181.2, 166.0],
      lic_atp:         [181.1, 174.3],
      lic_flighteng:   [294.8, 166.0],
      lic_flightinstr: [294.8, 174.3],
      lic_flightnav:   [433.8, 166.0],
      // B.
      basis_written:   [35.1, 201.8],
      // C. category / class
      cat_asel:        [40.1, 238.8],
      cat_amel:        [40.1, 263.1],
      cat_ases:        [39.9, 279.5],
      cat_ames:        [39.9, 295.0],
      cat_glider:      [179.8, 238.7],
      cat_heli:        [179.8, 263.4],
      cat_plift:       [179.3, 279.5],
      // D. rating
      rtg_instrument:  [39.5, 314.9],
      rtg_cat23:       [39.5, 331.0],
      rtg_addedtype:   [185.9, 314.9],
      rtg_other:       [185.9, 331.2],
      // 9. language proficiency level
      lang_4:          [546.6, 404.0],
      lang_5:          [546.6, 412.1],
      lang_6:          [546.5, 420.0],
      // H. failed a test
      failed_yes:      [467.5, 771.3],
      failed_no:       [521.5, 771.3],
    },

    sig: [390, 835, 185, 18],

    /* F. RECORD OF PILOT TIME — grid on page 1.
       colX holds the 16 vertical rules, so column i spans colX[i]..colX[i+1].
       labelCols are the columns that already have "PIC"/"SIC" printed inside
       them, so the number is indented past that word.
       `shaded` lists the column indexes that are greyed out (not fillable)
       for that row. */
    pilotTime: {
      size: 7.5,
      indent: 20,
      labelCols: [3, 6, 10, 11],
      colX: [82.8, 106.1, 144.3, 165.9, 203.1, 241.3, 272.3, 303.2,
             340.0, 380.1, 419.9, 444.4, 485.0, 516.9, 551.5, 581.0],
      headers: ['Total', 'Instruction Recd', 'Solo', 'PIC', 'XC Instruction Recd',
                'XC Solo', 'XC PIC', 'Instrument', 'Night Instruction Recd',
                'Night T/O-Landing', 'Night PIC', 'Night T/O-Landing PIC',
                'No. of Flights', 'Ground Launches', 'Power Launches'],
      rows: [
        { k: 'airplane_pic',   label: 'Airplane — PIC',    t: 512.5, b: 528.6, shaded: [] },
        { k: 'airplane_sic',   label: 'Airplane — SIC',    t: 528.6, b: 545.2, shaded: [] },
        { k: 'heli_pic',       label: 'Helicopter — PIC',  t: 545.2, b: 562.2, shaded: [] },
        { k: 'heli_sic',       label: 'Helicopter — SIC',  t: 562.2, b: 579.7, shaded: [] },
        { k: 'plift_pic',      label: 'Powered Lift — PIC',t: 579.7, b: 598.0, shaded: [] },
        { k: 'plift_sic',      label: 'Powered Lift — SIC',t: 598.0, b: 615.5, shaded: [] },
        { k: 'gliders',        label: 'Gliders',           t: 615.5, b: 636.9, shaded: [6,7,8,9,10,11] },
        { k: 'freeballoon',    label: 'Free Balloon',      t: 636.9, b: 658.7, shaded: [10,11] },
        { k: 'airship',        label: 'Airship',           t: 658.7, b: 679.1, shaded: [10,11] },
        { k: 'simulator',      label: 'Simulator',         t: 679.1, b: 700.7, shaded: [0,2,3,4,5,6,8,9,10,11] },
        { k: 'trainingdevice', label: 'Training Device',   t: 700.7, b: 721.9, shaded: [0,2,3,4,5,6,8,9,10,11] },
      ],
    },

    fields: {
      aircraftUsed:  [152, 210, 150],
      totalTime:     [340, 210, 45],
      picTime:       [505, 209.6],
      glider_spec:   [352, 246.8, 190],
      heli_spec:     [352, 262.9, 190],
      plift_spec:    [352, 279, 190],
      addedtype_spec:[355, 322.9, 195],
      other_spec:    [355, 339, 195],

      name:        [36, 368, 265],
      address:     [311, 368, 265],
      telephone:   [36, 392, 265],
      city:        [311, 392, 52],  // auto-shrinks to fit
      province:    [367, 392, 95],
      mailcode:    [466, 392, 58],
      country:     [529, 392, 50],
      dob:         [36, 414, 110],
      age:         [154, 414, 55],
      pob:         [218, 414, 85],
      nationality: [311, 414, 155],
      height:      [36, 451, 55],
      weight:      [98, 451, 50],
      hair:        [155, 451, 55],
      eyes:        [218, 451, 50],
      sex:         [275, 451, 30],
      email:       [311, 451, 200],
      pelNo:       [519, 451, 70],
      /* Section G (medical): the template box is only 16pt tall and the labels use the top half,
         so values used to land BELOW the box. medBox repaints the bottom border 7pt lower so the
         values sit inside it. clear = old bottom line, bottom = new line, vLines = column rules. */
      medBox: { clear: [27.4, 752.0, 554.6, 1.0], bottom: [27.8, 759.3, 553.7, 0.55],
                vLines: [27.8, 145.2, 284.3, 423.5, 581.0], vTop: 752.0, vH: 7.8 },
      medClass:    [41, 748.3, 100],
      medState:    [158, 748.3, 122],
      medDate:     [297, 748.3, 122],
      medExaminer: [437, 748.3, 140],
      certDate:    [212.7, 838, 165],
    },
  },

  /* ---------- 3. PEL FORM 542 — OTHER THAN FLIGHT CREW ---------- */
  /* v7.4: re-measured on the corrected 2-page template (A-H on page 1, I-L on page 2).
     C.4 CITY / PROVINCE / ZIP CODE / COUNTRY is now ONE label row, so the values are
     printed BELOW their labels (never beside them) and shrink to fit their slot. */
  f542: {
    file: 'templates/form542.pdf',
    page: 0,
    size: [595.3, 841.9],
    fontSize: 8.5,

    checks: {
      act_issuance:      [180.3, 157.2],
      act_reissuance:    [225.8, 157.2],
      act_renewal:       [334.9, 157.0],
      act_additional:    [377.6, 157.0],

      lic_dispatcher:    [37.9, 180.4],
      lic_groundinstr:   [37.9, 193.9],
      lic_amt:           [37.9, 205.9],
      lic_inspauth:      [37.9, 218.5],
      lic_ams:           [196.4, 180.1],
      lic_aso:           [196.4, 192.9],
      lic_atc:           [196.8, 205.3],
      lic_rpa:           [196.8, 222.7],
      lic_atsep:         [366.7, 179.4],
      lic_studentatc:    [367.1, 191.2],
      lic_studentaso:    [367.0, 203.7],

      rtg_powerplant:    [35.5, 267.2],
      rtg_airframe:      [35.5, 281.3],
      rtg_electronics:   [35.5, 296.0],
      rtg_specialized:   [212.4, 267.0],
      rtg_atc:           [212.4, 280.6],
      rtg_gi:            [212.3, 294.7],

      basis_experience:  [325.6, 563.2],
      basis_written:     [407.9, 562.9],
      basis_skill:       [494.9, 563.2],

      failed_yes:        [307.8, 638.5],
      failed_no:         [361.9, 638.3],
    },

    sig: [366, 690.5, 200, 22],

    fields: {
      specialized_spec: [340, 267.0, 200],
      atc_spec:         [340, 281.2, 200],
      gi_spec:          [340, 294.9, 200],

      name:        [36, 339.3, 235],
      // permanent address: one line when it fits at >= addr.min pt, otherwise wrapped onto 2 lines
      address:     [281, 339.3, 288],
      addr:        { min: 7.2, two: { size: 6.5, top: 337.4, lh: 6.9 } },
      telephone:   [36, 365, 235],
      // C.4 slots: one line down to 6.6pt, then 2 lines of 5.9pt (so long names never get clipped)
      small2:      { min: 6.6, two: { size: 5.9, top: 363.6, lh: 6.2 } },
      city:        [281, 365, 78],
      province:    [363, 365, 64],
      zip:         [431, 365, 88],
      country:     [524, 365, 47],
      dob:         [36, 396.4, 118],
      age:         [160, 396.4, 40],
      pob:         [206, 396.4, 120],
      nationality: [331, 396.4, 130],
      langText:    [471, 396.4, 98],
      height:      [36, 429.5, 18],
      weight:      [110, 430, 28],
      hair:        [174, 424.8, 30],
      eyes:        [219, 424.8, 30],
      sex:         [252, 424.8, 42],
      email:       [296, 424.8, 200],
      pelNo:       [503, 424.8, 68],
      licenseNo:   [36, 470.4, 100],
      licenseType: [155, 470.4, 150],
      stateIssue:  [325, 470.4, 112],
      dateIssued:  [456, 470.4, 112],
      ratings:     [45, 494.7, 525],
      limitations: [45, 518.0, 525],
      endorsements:[45, 541.2, 525],
      medClass:    [43, 617.1, 108],
      medState:    [165, 617.1, 108],
      medDate:     [292, 617.1, 82],
      medExaminer: [382, 617.1, 188],
      certDate:    [286, 692.8, 72],
    },
  },
};
