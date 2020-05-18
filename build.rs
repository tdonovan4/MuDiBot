use std::{
    env, fs,
    io::{self, ErrorKind},
    path::Path,
};

/// A function to build the localization files into the executable
fn build_localization_resources() -> io::Result<()> {
    println!("cargo:rerun-if-changed=resources");

    // Get where the localization resources files are located
    let manifest_dir = env::var_os("CARGO_MANIFEST_DIR").ok_or(io::Error::new(
        ErrorKind::NotFound,
        "missing CARGO_MANIFEST_DIR",
    ))?;
    let manifest_dir_path = Path::new(&manifest_dir);
    let resources_dir = manifest_dir_path.join("resources");

    // Get the output destination
    let out_dir =
        env::var_os("OUT_DIR").ok_or(io::Error::new(ErrorKind::NotFound, "missing OUT_DIR"))?;
    let out_dir_path = Path::new(&out_dir);
    let destination = out_dir_path.join("l10n_res.rs");

    // This is where the magic happens, this fetch all the files of every locale directories
    // and then transform them into constants holding the value of these files
    let resources = resources_dir
        .read_dir()?
        .map(|locale_dir| {
            // This is run on every locale dir, we start by getting its name
            let locale_os_string = locale_dir?.file_name();
            let locale = locale_os_string.to_string_lossy();

            println!("cargo:rerun-if-changed=resources/{}", locale);

            // This a const so that we can use it's length later on
            const FILE_NAMES: &[&str] = &["commands", "errors"];

            // We start the const for this current locale
            let mut res_const = format!(
                "pub const {}: [&str; {}] = [\n",
                locale.to_uppercase().replace("-", "_"),
                FILE_NAMES.len()
            );

            // The middle part gets run on every file
            let middle = FILE_NAMES
                .iter()
                .map(|file_name| {
                    println!("cargo:rerun-if-changed=resources/{}/{}", locale, file_name);

                    // We include the content of the file so we have it in the binary
                    Ok(format!(
                        "  include_str!(\"{}/{}/{}.ftl\"),\n",
                        resources_dir.display(),
                        locale,
                        file_name
                    ))
                })
                .collect::<io::Result<String>>()?;
            res_const += middle.as_str();

            // The end of the const
            res_const += "];\n\n";

            Ok(res_const)
        })
        .collect::<io::Result<String>>()?;

    // Write to destination
    fs::write(&destination, resources)?;

    Ok(())
}

fn main() -> io::Result<()> {
    build_localization_resources()?;

    Ok(())
}
