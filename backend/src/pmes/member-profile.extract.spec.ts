import { deriveFromMemberProfile } from "./member-profile.extract";

describe("deriveFromMemberProfile", () => {
  it("maps contact.mobileNo to phone and composes displayFullName", () => {
    const profile = {
      personal: {
        firstName: "Nilo",
        middleName: "B.",
        lastName: "Matunog",
        suffixName: "",
        civilStatus: "Single",
        sexGender: "Male",
      },
      contact: {
        mobileNo: "+63 917 000 0000",
        emailAddress: "n@example.com",
      },
      presentAddress: {
        houseNo: "1",
        street: "Main",
        barangay: "Centro",
        cityMunicipality: "City",
        province: "Prov",
        region: "Region",
        country: "PH",
        postalCode: "1234",
      },
    };
    const d = deriveFromMemberProfile(profile);
    expect(d.phone).toBe("+63 917 000 0000");
    expect(d.displayFullName).toBe("Nilo B. Matunog");
    expect(d.sexGender).toBe("Male");
    expect(d.mailingAddress).toContain("Main");
    expect(d.civilStatus).toBe("Single");
  });
});
